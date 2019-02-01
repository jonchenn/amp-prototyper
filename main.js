const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const fse = require('fs-extra'); // v 5.0.0
const path = require('path');
const beautify = require('js-beautify').html;

const IMG_SELECTOR = 'amp-img';

let url = 'http://127.0.0.1:8080/';
let escapedUrl = url.replace('https://', '').replace('\/', '|');
let envVars = {
  '%%VAR_URL%%': encodeURI(url),
};

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
      regex: '<script[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>',
      replace: '',
    }, {
      log: 'Remove third-party elements',
      actionType: 'replace',
      selector: 'html',
      regex: '<.*(src|href)=(?!"(%%VAR_URL%%|#)).*>',
      replace: '',
    }],
    beautify: true,
  },
  {
    name: 'Remove disallowed attributes',
    actions: [{
      log: 'Remove onclick',
      actionType: 'replace',
      selector: 'html',
      regex: '(onclick|controlheight|controlwidth|aria-description|adhocenable|data-[^=]*)=\"[^"]*\"',
      replace: '',
    }],
    beautify: true,
  },
  {
    name: 'Make relative URLs absolute',
    actions: [{
      log: 'Update relative URLs',
      actionType: 'replace',
      selector: 'html',
      regex: '(href|src)=\"([/a-zA-Z0-9\.]+)\"',
      replace: '$1="%%VAR_URL%%$2"',
    }],
    beautify: true,
  },
  {
    name: 'Set HTML tag with AMP',
    actions: [{
    }],
  },
  {
    name: 'Add AMP JS library and AMP boilerplate',
    actions: [{
      actionType: 'setAttribute',
      selector: 'html',
      attribute: 'amp',
      value: '',
    }, {
      log: 'Update viewport',
      actionType: 'replaceOrInsert', // replaceOrInsert
      selector: 'head',
      regex: '<meta name="viewport"([\sa-zA-Z1-9=\"\-\,]*)>',
      replace: '<meta name="viewport" content="width=device-width,minimum-scale=1,initial-scale=1">',
    }, {
      log: 'Add AMP JS library.',
      actionType: 'appendAfter',
      selector: 'title',
      value: '<script async src="https://cdn.ampproject.org/v0.js"></script>',
    // }, {
    //   log: 'Add AMP boilerplate.',
    //   actionType: 'insertBottom',
    //   selector: 'head',
    //   value: '',
    }],
    beautify: true,
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
  await fse.outputFile(filePath, html);
}

async function run() {
  const browser = await puppeteer.launch({
    headless: true
  });
  const page = await browser.newPage();
  page.on('console', consoleObj => console.log(consoleObj.text()));

  await page.emulate(devices['Pixel 2']);
  await page.goto(url);
  await outputToFile(`output-step-0.html`, await page.content());
  await page.screenshot({path: `output/${escapedUrl}/output-step-0.png`});

  const self = {
    outputToFile: outputToFile,
  };

  let i = 1;
  let stepOutput = '';
  for (let i=0; i<steps.length; i++) {
    let step = steps[i];
    if (!step.actions || step.skip) continue;
    console.log(`=> Step ${i+1}: ${step.name}`);

    step.actions.forEach(async (action) => {
      Object.keys(action).forEach((prop) => {
        action[prop] = replaceEnvVars(action[prop]);
      });

      let message = action.actionType;

      switch (action.actionType) {
        case 'setAttribute':
          message = await page.evaluate(async (action) => {
            let el = document.querySelector(action.selector);
            el.setAttribute(action.attribute, action.value);
            return `set ${action.attribute} as ${action.value}`;
          }, action);
          break;

        case 'replace':
          message = await page.evaluate(async (action) => {
            let el = document.querySelector(action.selector);
            if (!el) return `No matched regex: ${action.selector}`;

            let html = el.outerHTML;
            let regex = new RegExp(action.regex, 'ig');
            let matches = html.match(regex, 'ig');
            html = html.replace(regex, action.replace);
            el.innerHTML = html;
            return `${matches ? matches.length : 0} replaced`;
          }, action);
          break;

        case 'replaceOrInsert':
          message = await page.evaluate(async (action) => {
            let el = document.querySelector(action.selector);
            if (!el) return `No matched regex: ${action.selector}`;

            let html = el.outerHTML;
            let regex = new RegExp(action.regex, 'ig');
            if (html.match(regex, 'ig')) {
              html = html.replace(regex, action.replace);
              el.innerHTML = html;
              return 'Replaced';
            } else {
              var temp = document.createElement('template');
              temp.innerHTML = action.replace;
              temp.content.childNodes.forEach((node) => {
                el.appendChild(node);
              });
              return `Inserted in ${action.selector}`;
            }
          }, action);
          break;

        case 'insertBottom':
          message = await page.evaluate(async (action) => {
            let el = document.querySelector(action.selector);
            if (!el) return `No matched regex: ${action.selector}`;

            let html = el.outerHTML;
            var temp = document.createElement('template');
            temp.innerHTML = action.replace;
            temp.content.childNodes.forEach((node) => {
              el.appendChild(node);
            });
            return `Inserted in ${action.selector}`;
          }, action);
          break;

        case 'appendAfter':
          message = await page.evaluate(async (action) => {
            let el = document.querySelector(action.selector);
            if (!el) return `No matched regex: ${action.selector}`;

            var temp = document.createElement('template');
            temp.innerHTML = action.value;
            temp.content.childNodes.forEach((node) => {
              el.parentNode.insertBefore(node, el.nextSibling);
            });
            return;
          }, action);
          break;

        default:
          break;
      }
      console.log(`---> ${action.log}: ${message}`);

    });

    if (step.beautify) {
      let html = await page.content();
      await page.setContent(beautify(html, {
        indent_size: 2,
        preserve_newlines: false,
      }));
    }

    await outputToFile(`output-step-${i+1}.html`, await page.content());
    await page.screenshot({path: `output/${escapedUrl}/output-step-${i+1}.png`});
  }

  await browser.close();
}

run();
