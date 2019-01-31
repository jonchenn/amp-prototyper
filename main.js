const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const fse = require('fs-extra'); // v 5.0.0
const path = require('path');
const pretty = require('pretty');

const IMG_SELECTOR = 'amp-img';

const steps = [
  {
    name: 'AMP boilerplate',
    actions: [{
      actionType: 'setAttribute',
      selector: 'html',
      attribute: 'amp',
      value: true,
    // }, {
    //   actionType: 'appendAfter',
    //   selector: 'title',
    //   value: '<script async src="https://cdn.ampproject.org/v0.js"></script>',
    }],
  },
  {
    name: 'Make relative URLs absolute',
    actions: [{
      actionType: 'replace',
      selector: 'html',
      find: '(href|src)="\/(.*)"',
      replace: '${1}="https:\/\/www\.example\.com/${2}',
    }],
  },
];

async function outputToFile(filename, content, options) {
  let filePath = path.resolve(`./output/${filename}`);
  await fse.outputFile(filePath, pretty(content));
}

async function run() {
  const browser = await puppeteer.launch({
    headless: false
  });
  const page = await browser.newPage();
  page.on('console', consoleObj => console.log(consoleObj.text()));

  await page.emulate(devices['Pixel 2']);
  await page.goto('https://jonchen-lab.firebaseapp.com');
  await outputToFile(`output-step-0.html`, await page.content());
  await page.screenshot({path: `output/output-step-0.png`});

  const self = {
    outputToFile: outputToFile,
  };

  let i = 1;
  let stepOutput = '';
  for (let i=0; i<steps.length; i++) {
    let step = steps[i];
    console.log(`Step: ${step.name}`);
    if (!step.actions) return;

    step.actions.forEach(async (action) => {
      console.log(`--> ${action.actionType}`);

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
            let html = el.outerHTML;
            html = html.replace(action.find, action.replace);
            el.innerHTML = html;
            return;
          }, action);
          break;

        default:
          break;
      }
    });
    await outputToFile(`output-step-${i+1}.html`, await page.content());
    await page.screenshot({path: `output/output-step-${i+1}.png`});
  }

  await browser.close();
}

run();
