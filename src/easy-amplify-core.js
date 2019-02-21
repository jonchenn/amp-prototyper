const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const fse = require('fs-extra');
const mkdirp = require('mkdirp');
const path = require('path');
const beautify = require('js-beautify').html;
const colors = require('colors');
const amphtmlValidator = require('amphtml-validator');
const purify = require("purify-css")
const argv = require('minimist')(process.argv.slice(2));
const CleanCSS = require('clean-css');
const assert = require('assert');
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
  let errors = [];

  let result = ampValidator.validateString(html);
  if (result.status === 'PASS') {
    console.log('\tAMP validation successful.'.green);
  } else {
    result.errors.forEach((e) => {
      var msg = `line ${e.line}, col ${e.col}: ${e.message}`;
      if (e.specUrl) msg += ` (see ${e.specUrl})`;
      if (verbose) console.log('\t' + msg.dim);
      errors.push(msg);
    });
    console.log(`\t${errors.length} AMP validation errors.`.red);
  }
  return Promise.resolve(errors);
}

function matchAmpErrors(errors, ampErrorsRegex) {
  let resultSet = new Set();
  errors.forEach(error => {
    let matches = error.match(new RegExp(ampErrorsRegex));
    if (matches) {
      resultSet.add(matches);
    }
  });
  return resultSet;
}

function beautifyHtml(sourceDom) {
  // Beautify html.
  let html = beautify(sourceDom.documentElement.outerHTML, {
    indent_size: 2,
    preserve_newlines: false,
    content_unformatted: ['script', 'style'],
  });
  return '<!DOCTYPE html>\n' + html;
}

async function writeToFile(filename, html, options) {
  let filePath = path.resolve(`./output/${outputPath}/${filename}`);
  await fse.outputFile(filePath, html);
}

async function amplifyFunc(browser, url, steps, argv) {
  argv = argv || {};
  outputPath = argv['output'] || '';
  verbose = argv.hasOwnProperty('verbose');

  let device = argv['device'] || 'Pixel 2'
  let consoleOutputs = [];

  // Print warnings when missing necessary arguments.
  assert(url, 'Missing url.');
  assert(steps, 'Missing steps');

  let domain = url.match(/(https|http)\:\/\/[\w.-]*(\:\d+)?/i)[0];
  assert(domain, 'Unable to get domain from ' + url);

  envVars = {
    '%%URL%%': encodeURI(url),
    '%%DOMAIN%%': domain,
  };

  console.log('Url: ' + url.green);
  console.log('Domain: ' + domain.green);

  const page = await browser.newPage();
  await page.emulate(devices[device]);
  page.on('response', collectStyles);
  page.on('console', (consoleObj) => {
    consoleOutputs.push(consoleObj.text());
  });

  console.log('Step 0: loading page.'.yellow);

  // Open URL and save source to sourceDom.
  const response = await page.goto(url);
  let pageSource = await response.text();
  let pageContent = await page.content();
  sourceDom = new JSDOM(pageContent).window.document;
  let ampErrors = await validateAMP(pageContent);

  // Create directory if it doesn't exist.
  mkdirp(`./output/${outputPath}/`, (err) => {
    if (err) throw new Error(`Unable to create directory ${err}`);
  });

  // Output initial HTML, screenshot and amp errors.
  await writeToFile(`output-step-0.html`, pageContent);
  await page.screenshot({
    path: `output/${outputPath}/output-step-0.png`
  });
  await writeToFile(`output-step-0-log.txt`, ampErrors.join('\n'));

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

      let elements, el, elHtml, regex, matches, newEl, body, newStyles;
      let numReplaced = 0;
      let message = action.actionType;

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

        case 'replaceBasedOnAmpErrors':
          elements = sourceDom.querySelectorAll(action.selector);
          if (!elements.length) return `No matched regex: ${action.selector}`;

          let ampErrorMatches = matchAmpErrors(ampErrors, action.ampErrorRegex);
          let regexStr;

          elements.forEach((el) => {
            ampErrorMatches.forEach(matches => {
              regexStr = action.regex;
              for (let i=1; i<=9; i++) {
                if (matches[i]) {
                  regexStr = regexStr.replace(new RegExp('\\$' + i, 'g'), matches[i]);
                }
              }
              regex = new RegExp(regexStr, 'ig');
              matches = sourceDom.documentElement.innerHTML.match(regex, 'ig');
              numReplaced += matches ? matches.length : 0;
              sourceDom.documentElement.innerHTML =
                  sourceDom.documentElement.innerHTML.replace(regex, ' ');
            });
          });
          message = `${numReplaced} replaced based on AMP errors.`;
          break;

        case 'replace':
          elements = sourceDom.querySelectorAll(action.selector);
          if (!elements.length) return `No matched regex: ${action.selector}`;

          elements.forEach((el) => {
            elHtml = el.outerHTML;
            regex = new RegExp(action.regex, 'ig');
            matches = elHtml.match(regex, 'ig');
            numReplaced += matches ? matches.length : 0;
            elHtml = elHtml.replace(regex, action.replace);
            el.innerHTML = elHtml;
          });
          message = `${numReplaced} replaced`;
          break;

        case 'replaceOrInsert':
          el = sourceDom.querySelector(action.selector);
          if (!el) return `No matched regex: ${action.selector}`;

          elHtml = el.outerHTML;
          regex = new RegExp(action.regex, 'ig');
          if (elHtml.match(regex, 'ig')) {
            elHtml = elHtml.replace(regex, action.replace);
            el.innerHTML = elHtml;
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
            el.parentNode.removeChild(el);
          });

          el = sourceDom.querySelector(action.targetSelector);
          firstEl.innerHTML = mergedContent;
          el.innerHTML += firstEl.outerHTML;
          message = `Merged ${elements.length} doms`;
          break;

        case 'inlineExternalStyles':
          el = sourceDom.querySelector(action.selector);
          if (!el) return `No matched regex: ${action.selector}`;

          newStyles = action.minify ?
            new CleanCSS({}).minify(allStyles).styles : allStyles;

          newEl = sourceDom.createElement('style');
          newEl.appendChild(sourceDom.createTextNode(newStyles));
          (action.attributes || []).forEach((attr) => {
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
          console.log(`${action.actionType} is not supported.`.red);
          break;
      }
      console.log(`\t${action.log || action.actionType}: ${message}`.reset);
    });

    // Beautify html and update to source DOM.
    let html = beautifyHtml(sourceDom);
    sourceDom.documentElement.innerHTML = html;

    // Write HTML to file.
    await writeToFile(`output-step-${i+1}.html`, html);

    // Update page content with updated HTML.
    await page.setContent(html, {
      waitUntil: 'networkidle0',
    });

    // Take and save screenshot to file.
    await page.waitFor(200);
    await page.screenshot({
      path: `output/${outputPath}/output-step-${i+1}.png`
    });

    // Validate AMP.
    ampErrors = await validateAMP(html);
    if (ampErrors) {
      await writeToFile(`output-step-${i+1}-log.txt`, ampErrors.join('\n'));
    }
  }

  // Write final outcome to file.
  await writeToFile(`output-final.html`, beautifyHtml(sourceDom));
  await page.screenshot({
    path: `output/${outputPath}/output-final.png`
  });
}

async function amplify(url, steps, argv) {
  let isHeadless = argv['headless'] ? argv['headless'] === 'true' : true;

  // Start puppeteer.
  const browser = await puppeteer.launch({
    headless: isHeadless,
  });

  try {
    await amplifyFunc(browser, url, steps, argv);
    console.log('Complete.'.green);

  } catch(e) {
    console.error(e);
    console.log('Complete with errors.'.yellow);

  } finally {
    if (browser) await browser.close();
  }
}

module.exports = {
  amplify: amplify,
};
