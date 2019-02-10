const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const fse = require('fs-extra'); // v 5.0.0
const path = require('path');
const beautify = require('js-beautify').html;
const colors = require('colors');
const amphtmlValidator = require('amphtml-validator');
const purify = require("purify-css")
const argv = require('minimist')(process.argv.slice(2));
const CleanCSS = require('clean-css');
const {
  JSDOM
} = require("jsdom");

let outputPath, verbose, envVars;
let styleByUrls = {},
  allStyles = '';
var sourceDom = null;

function replaceEnvVars(str) {
  Object.keys(envVars).forEach((key) => {
    if (typeof str === 'string') {
      str = str.replace(key, envVars[key]);
    }
  });
  return str;
}

async function outputToFile(filename, html, options) {
  let filePath = path.resolve(`./output/${outputPath}/${filename}`);
  await fse.outputFile(filePath, html);
}

async function collectStyles(response) {
  if (response.request().resourceType() === 'stylesheet') {
    let url = await response.url();
    let text = await response.text();
    allStyles += text;
    styleByUrls[url] = text;
  }
}

async function validateAMP(html) {
  const ampValidator = await amphtmlValidator.getInstance();
  let allMsgs = '';

  let result = ampValidator.validateString(html);
  if (result.status === 'PASS') {
    console.log('\tAMP validation successful.'.green);
  } else {
    if (verbose) {
      result.errors.forEach((e) => {
        var msg = `line ${e.line}, col ${e.col}: ${e.message}`;
        if (e.specUrl !== null) {
          msg += ` (see ${e.specUrl})`;
        }
        console.log('\t' + msg.dim);
        allMsgs += msg + '\n';
      });
    }
    console.log(`\t${result.errors.length} AMP validation errors.`.red);
  }
  return Promise.resolve(allMsgs);
}

async function amplify(url, steps, argv) {
  argv = argv || {};
  outputPath = argv['output'] || '';
  verbose = argv.hasOwnProperty('verbose');
  let device = argv['device'] || 'Pixel 2'
  let isHeadless = argv['headless'] ? argv['headless'] === 'true' : true;

  // Print warnings when missing necessary arguments.
  if (!url || !steps) {
    console.log('Missing url or steps.');
    return;
  }

  let consoleOutputs = [];
  let domain = url.match(/(https|http)\:\/\/[\w.-]*/i)[0];
  if (!domain) {
    throw new Error('Unable to get domain from ' + url);
  }

  envVars = {
    '%%URL%%': encodeURI(url),
    '%%DOMAIN%%': domain,
  };

  console.log('Url: ' + url.green);
  console.log('Domain: ' + domain.green);

  // Start puppeteer.
  const browser = await puppeteer.launch({
    headless: isHeadless,
  });
  const page = await browser.newPage();
  await page.emulate(devices[device]);
  page.on('response', collectStyles);
  page.on('console', (consoleObj) => {
    consoleOutputs.push(consoleObj.text());
  });

  // Open URL and save source to sourceDom.
  const response = await page.goto(url);
  let pageSource = await response.text();
  let pageContent = await page.content();
  sourceDom = new JSDOM(pageContent).window.document;

  console.log('Start.');
  await outputToFile(`output-step-0.html`, pageContent);
  await page.screenshot({
    path: `output/${outputPath}/output-step-0.png`
  });

  // Clear page.on listener.
  page.removeListener('response', collectStyles);

  let i = 1;
  let stepOutput = '';

  for (let i = 0; i < steps.length; i++) {
    let step = steps[i];
    consoleOutputs = [];

    if (!step.actions || step.skip) continue;
    console.log(`Step ${i+1}: ${step.name}`.yellow);

    step.actions.forEach(async (action) => {
      Object.keys(action).forEach((prop) => {
        action[prop] = replaceEnvVars(action[prop]);
      });

      let message = action.actionType;
      let elements, el, html, regex, matches, newEl, body, newStyles;

      if (action.waitAfterLoaded) {
        await page.waitFor(action.waitAfterLoaded);
      }

      switch (action.actionType) {
        case 'setAttribute':
          elements = sourceDom.querySelectorAll(action.selector);
          elements.forEach((el) => {
            el.setAttribute(action.attribute, action.value);
          });
          message = `set ${action.attribute} as ${action.value}`;
          break;

        case 'removeAttribute':
          elements = sourceDom.querySelectorAll(action.selector);
          elements.forEach((el) => {
            el.removeAttribute(action.attribute);
          });
          message = `remove ${action.attribute} from ${elements.length} elements`;
          break;

        case 'replace':
          var numReplaced = 0;
          elements = sourceDom.querySelectorAll(action.selector);
          if (!elements.length) return `No matched regex: ${action.selector}`;

          elements.forEach((el) => {
            html = el.outerHTML;
            regex = new RegExp(action.regex, 'ig');
            matches = html.match(regex, 'ig');
            numReplaced += matches ? matches.length : 0;
            html = html.replace(regex, action.replace);
            el.innerHTML = html;
          });
          message = `${numReplaced} replaced`;
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
          message = 'Dom appended';
          break;

        // Merge multiple DOMs into one.
        case 'mergeContent':
          elements = sourceDom.querySelectorAll(action.selector);
          if (!elements.length) return `No matched regex: ${action.selector}`;

          var mergedContent = '';
          var firstEl = elements[0];
          elements.forEach((el) => {
            mergedContent += el.innerHTML + '\n';
            if (el !== firstEl) el.parentNode.removeChild(el);
          });
          firstEl.innerHTML = mergedContent;
          message = `Merged ${elements.length} doms`;
          break;

        case 'inlineExternalStyles':
          el = sourceDom.querySelector(action.selector);
          if (!el) return `No matched regex: ${action.selector}`;

          newStyles = action.minify ?
            new CleanCSS({}).minify(allStyles).styles : allStyles;

          newEl = sourceDom.createElement('style');
          newEl.appendChild(sourceDom.createTextNode(newStyles));
          action.attributes.forEach((attr) => {
            let key, value;
            [key, value] = attr.split('=');
            newEl.setAttribute(key, value || '');
          });
          el.appendChild(newEl);
          message = 'styles appended';
          break;

        case 'removeUnusedStyles':
          elements = sourceDom.querySelectorAll(action.selector);
          if (!elements.length) return `No matched regex: ${action.selector}`;

          body = sourceDom.querySelector('body');
          let oldSize = 0, newSize = 0;
          elements.forEach((el) => {
            oldSize += el.innerHTML.length;
            newStyles = new CleanCSS({}).minify(el.innerHTML).styles;
            newStyles = purify(body.innerHTML, newStyles, {
              minify: action.minify || false,
            });
            newSize += newStyles.length;
            el.innerHTML = newStyles;
          });

          let ratio = Math.round(
              (oldSize - newSize) / oldSize * 100);
          message = `Removed ${ratio}% styles. (${oldSize} -> ${newSize})`;
          break;

        case 'customFunc':
          if (action.customFunc) {
            await action.customFunc(action, sourceDom, page);
          }
          break;

        default:
          break;
      }
      console.log(`\t${action.log || action.actionType}: ${message}`.reset);
    });

    let html = '<!doctype html>\n' + sourceDom.documentElement.outerHTML;

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
    await page.screenshot({
      path: `output/${outputPath}/output-step-${i+1}.png`
    });

    // Validate AMP.
    let allErrors = await validateAMP(html);
    if (allErrors) {
      await outputToFile(`output-step-${i+1}-log.txt`, allErrors);
    }
  }

  await browser.close();
  console.log('Complete.'.green);
}

module.exports = {
  amplify: amplify,
};
