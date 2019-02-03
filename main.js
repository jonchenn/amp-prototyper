const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const fse = require('fs-extra'); // v 5.0.0
const path = require('path');
const beautify = require('js-beautify').html;
const colors = require('colors');
const { JSDOM } = require("jsdom");;

const IMG_SELECTOR = 'amp-img';

let url = 'http://127.0.0.1:8080';
let escapedUrl = url.replace('https://', '').replace('\/', '|');
let envVars = {
  '%%URL%%': encodeURI(url),
};
let styleByUrls = {}, allStyles = '';
var sourceDom = null;

const steps = [
  {
    name: 'Clean up unsupported elements',
    actions: [{
      log: 'Remove iframe',
      actionType: 'replace',
      selector: 'html',
      regex: '<iframe.*<\/iframe>',
      replace: '',
    }, {
      log: 'Remove inline scripts',
      actionType: 'replace',
      selector: 'html',
      regex: '(<!--)?.*<script[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>.*(-->)?',
      replace: '',
    }, {
      log: 'Remove third-party elements',
      actionType: 'replace',
      selector: 'html',
      regex: '(<!--)?.*<(script|link) .*(src|href)=(?!"(%%URL%%|#)).*>.*(?:-->)?',
      replace: '',
    }],
  },
  {
    name: 'Inline all CSS styles in <head>',
    actions: [{
      log: 'append styles',
      actionType: 'appendStyle',
      selector: 'head',
      excludeDomains: [],
      attributes: ['amp-custom'],
    }],
  },
  {
    name: 'Remove disallowed attributes',
    actions: [{
      log: 'Remove attributes: onclick|controlheight|controlwidth|aria-description|adhocenable|data',
      actionType: 'replace',
      selector: 'html',
      regex: '(onclick|controlheight|controlwidth|aria-description|adhocenable|data-[^=]*)=\"[^"]*\"',
      replace: '',
    }, {
      log: 'Remove to|expect|of|mind|promise|menu:click|onclick|privacy-policy|policy|sign-in|nav:clicked|my-account',
      actionType: 'replace',
      selector: 'html',
      regex: '(to|expect|of|mind|promise|menu:click|onclick|privacy-policy|policy|sign-in|nav:clicked|my-account)=\"[^"]*\"',
      replace: '',
    }],
  },
  {
    name: 'Make relative URLs absolute',
    actions: [{
      log: 'Update relative URLs',
      actionType: 'replace',
      selector: 'html',
      regex: '(href|src)=\"([/a-zA-Z0-9\.]+)\"',
      replace: '$1="%%URL%%/$2"',
    }],
  },
  {
    name: 'Add AMP JS library and AMP boilerplate',
    actions: [{
      log: 'Set HTML tag with AMP',
      actionType: 'setAttribute',
      selector: 'html',
      attribute: 'amp',
      value: '',
    }, {
      log: 'Add AMP JS library.',
      actionType: 'insertBottom',
      selector: 'head',
      value: '<script async src="https://cdn.ampproject.org/v0.js"></script>',
    }, {
      log: 'Update viewport',
      actionType: 'replaceOrInsert',
      selector: 'head',
      regex: '<meta name="viewport"([\sa-zA-Z1-9=\"\-\,]*)>',
      replace: '<meta name="viewport" content="width=device-width,minimum-scale=1,initial-scale=1">',
    }, {
      log: 'Update charset to UTF-8',
      actionType: 'replaceOrInsert',
      selector: 'head',
      regex: '<meta charset=".*">',
      replace: '<meta charset="utf-8">',
    }, {
      log: 'Add canonical link.',
      actionType: 'insertBottom',
      selector: 'head',
      value: '<link rel=canonical href="%%URL%%">',
    }, {
      log: 'Add AMP boilerplate.',
      actionType: 'insertBottom',
      selector: 'head',
      value: '<style amp-boilerplate>body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;animation:-amp-start 8s steps(1,end) 0s 1 normal both}@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-o-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}</style><noscript><style amp-boilerplate>body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}</style></noscript>',
    }],
  },
  {
    name: 'Convert img to amp-img',
    actions: [{
      log: 'replace img to amp-img',
      actionType: 'replace',
      selector: 'html',
      regex: '<img(.*)>(</img>)?',
      replace: '<amp-img $1></amp-img>',
    }, {
      log: 'Set responsive layout',
      actionType: 'setAttribute',
      selector: 'amp-img',
      attribute: 'width',
      value: '1',
    }, {
      log: 'Set responsive layout',
      actionType: 'setAttribute',
      selector: 'amp-img',
      attribute: 'height',
      value: '1',
    }, {
      log: 'Set responsive layout',
      actionType: 'setAttribute',
      selector: 'amp-img',
      attribute: 'layout',
      value: 'responsive',
    }],
  },
];

function replaceEnvVars(str) {
  Object.keys(envVars).forEach((key) => {
    if (typeof str === 'string') {
      str = str.replace(key, envVars[key]);
    }
  });
  return str;
}

async function outputToFile(filename, html, options) {
  let filePath = path.resolve(`./output/${escapedUrl}/${filename}`);
  await fse.outputFile(filePath, '<!doctype html>\n' + html);
}

async function collectStyles(response) {
  if(response.request().resourceType() === 'stylesheet') {
    let url = await response.url();
    let text = await response.text();
    allStyles += text;
    styleByUrls[url] = text;
  }
}

async function run() {
  let consoleOutput = '';

  const browser = await puppeteer.launch({
    headless: true
  });
  const page = await browser.newPage();
  await page.emulate(devices['Pixel 2']);
  page.on('response', collectStyles);
  page.on('console', (consoleObj) => {
    consoleOutput += consoleObj.text() + '\n';
  });

  // Add #development to the URL.
  if (url.match(/#.*=(\w)+/ig)) {
    url = url.replace(/#.*=(\w)+/ig, '#development=1');
  } else {
    url += '#development=1';
  }

  // Open URL and save source to sourceDom.
  const response = await page.goto(url);
  let pageSource = await response.text();
  sourceDom = new JSDOM(pageSource).window.document;
  console.log(`Open ${url}`.green);
  await outputToFile(`output-step-0.html`, pageSource);
  await page.screenshot({path: `output/${escapedUrl}/output-step-0.png`});

  // Clear page.on listener.
  page.removeListener('response', collectStyles);

  let i = 1;
  let stepOutput = '';

  for (let i=0; i<steps.length; i++) {
    let step = steps[i];
    consoleOutput = '';

    if (!step.actions || step.skip) continue;
    console.log(`Step ${i+1}: ${step.name}`.yellow);

    step.actions.forEach(async (action) => {
      Object.keys(action).forEach((prop) => {
        action[prop] = replaceEnvVars(action[prop]);
      });

      let message = action.actionType;
      let el, html, regex, matches, newEl;

      switch (action.actionType) {
        case 'setAttribute':
          el = sourceDom.querySelector(action.selector);
          el.setAttribute(action.attribute, action.value);
          message = `set ${action.attribute} as ${action.value}`;
          break;

        case 'replace':
          el = sourceDom.querySelector(action.selector);
          if (!el) return `No matched regex: ${action.selector}`;

          html = el.outerHTML;
          regex = new RegExp(action.regex, 'ig');
          matches = html.match(regex, 'ig');
          html = html.replace(regex, action.replace);
          el.innerHTML = html;
          message = `${matches ? matches.length : 0} replaced`;
          break;

        case 'replaceOrInsert':
          el = sourceDom.querySelector(action.selector);
          if (!el) return `No matched regex: ${action.selector}`;

          html = el.outerHTML;
          regex = new RegExp(action.regex, 'ig');
          if (html.match(regex, 'ig')) {
            html = html.replace(regex, action.replace);
            el.innerHTML = html;
            message = 'Replaced';
          } else {
            newEl = sourceDom.createElement('template');
            newEl.innerHTML = action.replace;
            newEl.content.childNodes.forEach((node) => {
              el.appendChild(node);
            });
            message = `Inserted in ${action.selector}`;
          }
          break;

        case 'insertBottom':
          el = sourceDom.querySelector(action.selector);
          if (!el) return `No matched regex: ${action.selector}`;

          el.innerHTML += (action.value || '');
          message = `Inserted in ${action.selector}`;
          break;

        case 'appendAfter':
          el = sourceDom.querySelector(action.selector);
          if (!el) return `No matched regex: ${action.selector}`;

          newEl = sourceDom.createElement('template');
          newEl.innerHTML = action.value;
          Array.from(newEl.content.childNodes).forEach((node) => {
            el.parentNode.insertBefore(node, el.nextSibling);
          });
          message = 'dom appended';
          break;

        case 'appendStyle':
          el = sourceDom.querySelector(action.selector);
          if (!el) return `No matched regex: ${action.selector}`;

          newEl = sourceDom.createElement('style');
          newEl.appendChild(sourceDom.createTextNode(allStyles));
          action.attributes.forEach((attr) => {
            let key, value;
            [key, value] = attr.split('=');
            newEl.setAttribute(key, value || '');
          });
          el.appendChild(newEl);
          message = 'styles appended';
          break;

        default:
          break;
      }
      console.log(`    ${action.log || action.actionType}: ${message}`.reset);
    });

    let html = sourceDom.documentElement.outerHTML;

    html = beautify(html, {
      indent_size: 2,
      preserve_newlines: false,
      content_unformatted: ['script', 'style'],
    });
    sourceDom.documentElement.innerHTML = html;

    await outputToFile(`output-step-${i+1}.html`, html);
    await page.setContent(html, {
      waitUntil: 'networkidle0',
    });
    await page.waitFor(200);
    await page.screenshot({path: `output/${escapedUrl}/output-step-${i+1}.png`});
  }

  await browser.close();
  console.log('Complete.'.green);
}

run();
