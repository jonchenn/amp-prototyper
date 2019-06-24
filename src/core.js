const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const fse = require('fs-extra');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
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

async function validateAMP(html, printResult) {
  const ampValidator = await amphtmlValidator.getInstance();
  let errors = [];

  let result = ampValidator.validateString(html);
  if (result.status === 'PASS') {
    if (printResult) console.log('\tAMP validation successful.'.green);
  } else {
    result.errors.forEach((e) => {
      var msg = `line ${e.line}, col ${e.col}: ${e.message}`;
      if (e.specUrl) msg += ` (see ${e.specUrl})`;
      if (verbose) console.log('\t' + msg.dim);
      errors.push(msg);
    });
    if (printResult)
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

async function runAction(action, sourceDom, page) {
  let elements, el, destEl, elHtml, regex, matches, newEl, body, newStyles;
  let numReplaced = 0;
  let message = action.actionType;

  // Replace the action's all properties with envVars values.
  Object.keys(action).forEach((prop) => {
    action[prop] = replaceEnvVars(action[prop]);
  });

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
      if (!elements.length) throw new Error(`No matched element(s): ${action.selector}`);

      let ampErrorMatches = matchAmpErrors(ampErrors, action.ampErrorRegex);
      let regexStr;
      let matchSet = new Set();

      elements.forEach((el) => {
        ampErrorMatches.forEach(matches => {
          regexStr = action.regex;
          for (let i=1; i<=9; i++) {
            if (matches[i]) {
              regexStr = regexStr.replace(new RegExp('\\$' + i, 'g'), matches[i]);
              matchSet.add(matches[i])
            }
          }
          regex = new RegExp(regexStr);
          matches = el.innerHTML.match(regex);
          numReplaced += matches ? matches.length : 0;
          el.innerHTML = el.innerHTML.replace(regex, action.replace);
        });
      });
      message = `${numReplaced} replaced: ${Array.from(matchSet).join(', ')}`;
      break;

    case 'replace':
      elements = sourceDom.querySelectorAll(action.selector);
      if (!elements.length) throw new Error(`No matched element(s): ${action.selector}`);

      elements.forEach((el) => {
        elHtml = el.innerHTML;
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
      if (!el) throw new Error(`No matched element(s): ${action.selector}`);

      elHtml = el.innerHTML;
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

    case 'insert':
      el = sourceDom.querySelector(action.selector);
      if (!el) throw new Error(`No matched element(s): ${action.selector}`);

      el.innerHTML += (action.value || '');
      message = `Inserted in ${action.selector}`;
      break;

    case 'appendAfter':
      el = sourceDom.querySelector(action.selector);
      if (!el) throw new Error(`No matched element(s): ${action.selector}`);

      newEl = sourceDom.createElement('template');
      newEl.innerHTML = action.value;
      Array.from(newEl.content.childNodes).forEach((node) => {
        el.parentNode.insertBefore(node, el.nextSibling);
      });
      message = 'Dom appended';
      break;

    case 'move':
      elements = sourceDom.querySelectorAll(action.selector);
      if (!elements.length) throw new Error(`No matched element(s): ${action.selector}`);

      destEl = sourceDom.querySelector(action.destSelector);
      if (!destEl) throw new Error(`No matched element: ${action.destSelector}`);

      var movedContent = '';
      elements.forEach((el) => {
        movedContent += el.outerHTML + '\n';
        el.parentNode.removeChild(el);
      });

      destEl.innerHTML += movedContent;
      message = `Moved ${elements.length} elements`;
      break;

    // Merge multiple DOMs into one.
    case 'mergeContent':
      elements = sourceDom.querySelectorAll(action.selector);
      if (!elements.length) throw new Error(`No matched element(s): ${action.selector}`);

      destEl = sourceDom.querySelector(action.destSelector);
      if (!destEl) throw new Error(`No matched element: ${action.destSelector}`);

      var mergedContent = '';
      var firstEl = elements[0];
      elements.forEach((el) => {
        mergedContent += el.innerHTML + '\n';
        el.parentNode.removeChild(el);
      });

      firstEl.innerHTML = mergedContent;
      destEl.innerHTML += firstEl.outerHTML;
      message = `Merged ${elements.length} elements`;
      break;

    case 'inlineExternalStyles':
      el = sourceDom.querySelector(action.selector);
      if (!el) throw new Error(`No matched element(s): ${action.selector}`);

      newStyles = action.minify ?
        new CleanCSS({}).minify(allStyles).styles : allStyles;

      newEl = sourceDom.createElement('style');
      newEl.appendChild(sourceDom.createTextNode(newStyles));
      el.appendChild(newEl);
      message = 'styles appended';
      break;

    case 'removeUnusedStyles':
      elements = sourceDom.querySelectorAll(action.selector);
      if (!elements.length) throw new Error(`No matched element(s): ${action.selector}`);

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
      elements = sourceDom.querySelectorAll(action.selector);
      if (!elements.length) throw new Error(`No matched element(s): ${action.selector}`);

      if (action.customFunc) {
        await action.customFunc(action, elements, page);
      }
      break;

    default:
      console.log(`${action.actionType} is not supported.`.red);
      break;
  }
  console.log(`\t${action.log || action.actionType}:`.reset + ` ${message}`.dim);

  // Beautify html and update to source DOM.
  html = beautifyHtml(sourceDom);
  sourceDom.documentElement.innerHTML = html;

  // Validate AMP.
  ampErrors = await validateAMP(html);

  // Update page content with updated HTML.
  await page.setContent(html, {
    waitUntil: 'networkidle0',
  });

  return html;
}

async function amplifyFunc(browser, url, steps, argv) {
  argv = argv || {};
  verbose = argv.hasOwnProperty('verbose');

  let device = argv['device'] || 'Pixel 2'
  let consoleOutputs = [];

  // Print warnings when missing necessary arguments.
  assert(url, 'Missing url.');
  assert(steps, 'Missing steps');

  let host = url.match(/(https|http)\:\/\/[\w.-]*(\:\d+)?/i)[0];
  let domain = host.replace(/http(s)?:\/\//ig, '');
  let urlWithoutProtocol = url.replace(/http(s)?:\/\//ig, '');
  assert(host, 'Unable to get host from ' + url);
  assert(domain, 'Unable to get domain from ' + url);

  // Set output subfolder using domain if undefined.
  outputPath = argv['output'] || urlWithoutProtocol.replace(/\//ig, '_');

  envVars = {
    '$URL': encodeURI(url),
    '$HOST': host,
    '$DOMAIN': domain,
  };

  console.log('Url: ' + url.green);
  console.log('Domain: ' + domain.green);

  // Create directory if it doesn't exist.
  mkdirp(`./output/${outputPath}/`, (err) => {
    if (err) throw new Error(`Unable to create directory ${err}`);
  });
  rimraf(`./output/${outputPath}/*`, () => {
    console.log(`Removed previous output in ./output/${outputPath}`.dim);
  });

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
  sourceDom = new JSDOM(pageContent, {url: host}).window.document;
  let ampErrors = await validateAMP(pageContent);

  // Output initial HTML, screenshot and amp errors.
  await writeToFile(`steps/output-step-0.html`, pageContent);
  await page.screenshot({
    path: `output/${outputPath}/steps/output-step-0.png`
  });
  await writeToFile(`steps/output-step-0-log.txt`, ampErrors.join('\n'));

  // Clear page.on listener.
  page.removeListener('response', collectStyles);

  let i = 1;
  let stepOutput = '';
  let html = beautifyHtml(sourceDom);

  for (let i = 0; i < steps.length; i++) {
    consoleOutputs = [];
    let step = steps[i];

    if (!step.actions || step.skip) continue;
    console.log(`Step ${i+1}: ${step.name}`.yellow);

    for (let j = 0; j < step.actions.length; j++) {
      let action = step.actions[j];

      try {
        // The sourceDom will be updated after each action.
        html = await runAction(action, sourceDom, page);
      } catch (e) {
        if (verbose) {
          console.log(e);
        } else {
          console.log(`\t${action.log || action.type}:`.reset +
            ` Error: ${e.message}`.red);
        }
      }
    }

    // Write HTML to file.
    await writeToFile(`steps/output-step-${i+1}.html`, html);

    // Update page content with updated HTML.
    await page.setContent(html, {
      waitUntil: 'networkidle0',
    });

    // Take and save screenshot to file.
    await page.waitFor(500);
    await page.screenshot({
      path: `output/${outputPath}/steps/output-step-${i+1}.png`
    });

    await writeToFile(`steps/output-step-${i+1}-log.txt`, (ampErrors || []).join('\n'));

    // Print AMP validation result.
    ampErrors = await validateAMP(html, true /* printResult */);
  }

  // Write final outcome to file.
  await writeToFile(`output-final.html`, html);
  await page.screenshot({
    path: `output/${outputPath}/output-final.png`
  });
  await writeToFile(`output-final-log.txt`, (ampErrors || []).join('\n'));
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
