const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const fse = require('fs-extra'); // v 5.0.0
const path = require('path');
const beautify = require('js-beautify').html;

const IMG_SELECTOR = 'amp-img';

// let url = 'https://jonchen-lab.firebaseapp.com';
let url = 'http://127.0.0.1:8080/';
let escapedUrl = url.replace('https://', '').replace('\/', '|');
let envVars = {
  '%%VAR_URL%%': encodeURI(url),
};


const steps = [
  {
    name: 'Make relative URLs absolute',
    actions: [{
      log: 'Update relative URLs',
      actionType: 'replace',
      selector: 'html',
      find: '(href|src)=\"([/a-zA-Z0-9\.]+)\"',
      replace: '$1="%%VAR_URL%%$2"',
    }],
    beautify: true,
  },
  {
    name: 'Set HTML tag with AMP',
    actions: [{
      actionType: 'setAttribute',
      selector: 'html',
      attribute: 'amp',
      value: true,
    }],
  },
  {
    name: 'Clean up unsupported elements',
    actions: [{
      log: 'Remove third-party elements',
      actionType: 'replace',
      selector: 'html',
      find: '<.*(src|href)=(?!"(%%VAR_URL%%|#)).*>',
      replace: '',
    }, {
      log: 'Remove inline scripts',
      actionType: 'replace',
      selector: 'html',
      find: '<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>',
      replace: '',
    }, {
      log: 'Remove iframe',
      actionType: 'replace',
      selector: 'html',
      find: '<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>',
      replace: '',
    // }, {
    //   log: 'Remove disallowed attributes',
    //   actionType: 'replace',
    //   selector: 'html',
    //   find: '(onclick=".*\"\"|onclick=".*\)\")',
    //   replace: '',
    }],
    beautify: true,
  },
  {
    name: 'Add AMP JS library and AMP boilerplate',
    actions: [{
      log: 'Add AMP JS library.',
      actionType: 'appendAfter',
      selector: 'title',
      value: '<script async src="https://cdn.ampproject.org/v0.js"></script>',
    }, {
      log: 'Add AMP boilerplate.',
      actionType: 'insertBottom',
      selector: 'head',
      value: '<script async src="https://cdn.ampproject.org/v0.js"></script>',
    }, {
      actionType: 'replaceOrInsert', // replaceOrInsert
      selector: 'head',
      find: '<meta name="viewport"([\sa-zA-Z1-9=\"\-\,]*)>',
      replace: '<meta name="viewport" content="width=device-width,minimum-scale=1,initial-scale=1">',
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
    console.log(`Step ${i+1}: ${step.name}`);
    if (!step.actions) return;

    step.actions.forEach(async (action) => {
      console.log(`--> ${action.log || action.actionType}`);

      Object.keys(action).forEach((prop) => {
        action[prop] = replaceEnvVars(action[prop]);
      });

      switch (action.actionType) {
        case 'setAttribute':
          await page.evaluate(async (action) => {
            let el = document.querySelector(action.selector);
            el.setAttribute(action.attribute, action.value);
            return;
          }, action);
          break;

        case 'replace':
          await page.evaluate(async (action) => {
            let el = document.querySelector(action.selector);
            if (!el) return;

            let html = el.outerHTML;
            html = html.replace(new RegExp(action.find, 'ig'), action.replace);
            el.innerHTML = html;
            return;
          }, action);
          break;

        case 'replaceOrInsert':
          await page.evaluate(async (action) => {
            let el = document.querySelector(action.selector);
            if (!el) return;

            let html = el.outerHTML;
            if (html.match(new RegExp(action.find, 'ig'))) {
              html = html.replace(new RegExp(action.find, 'ig'), action.replace);
              el.innerHTML = html;
            } else {
              var temp = document.createElement('template');
              temp.innerHTML = action.replace;
              temp.content.childNodes.forEach((node) => {
                el.appendChild(node);
              });
            }
            return;
          }, action);
          break;

        case 'appendAfter':
          await page.evaluate(async (action) => {
            let el = document.querySelector(action.selector);
            if (!el) {
              console.log(`No matched regex: ${action.selector}`);
              return;
            }
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
    });

    if (step.beautify) {
      let html = await page.content();
      await page.setContent(beautify(html.trim(), {
        indent_size: 2,
      }));
    }

    await outputToFile(`output-step-${i+1}.html`, await page.content());
    await page.screenshot({path: `output/${escapedUrl}/output-step-${i+1}.png`});
  }

  await browser.close();
}

run();
