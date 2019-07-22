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
const Diff = require('diff');
const assert = require('assert');
const httpServer = require('http-server');
const {
  JSDOM
} = require("jsdom");
const PNG = require('pngjs').PNG;
const pixelmatch = require('pixelmatch');


let outputPath, verbose, envVars;
let computedDimensions = {};
let styleByUrls = {},
  allStyles = '';
let port = 8080;
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
  let elements, el, destEl, elHtml, regex, matches, newEl, body;
  let numReplaced = 0,
    oldStyles = '',
    newStyles = '',
    optimizedStyles = '';
  let message = action.actionType;
  let result = {};

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
          for (let i = 1; i <= 9; i++) {
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
      oldStyles = '';
      newStyles = '';
      optimizedStyles = '';

      elements.forEach((el) => {
        // if (el.tagName !== 'style') return;
        oldStyles += el.innerHTML;

        // Use CleanCSS to prevent breaking from bad syntax.
        newStyles = new CleanCSS({
          all: false, // Disabled minification.
          format: 'beautify',
        }).minify(el.innerHTML).styles;

        // Use PurifyCSS to remove unused CSS.
        let purifyOptions = {
          minify: action.minify || false,
        };
        newStyles = purify(body.innerHTML, newStyles, purifyOptions);
        el.innerHTML = newStyles;
        optimizedStyles += '\n\n' + newStyles;
      });

      // Collect unused styles.
      if (action.outputCSS) {
        let diff = Diff.diffLines(optimizedStyles, oldStyles, {
          ignoreWhitespace: true,
        });
        let unusedStyles = '';
        diff.forEach((part) => {
          unusedStyles += part.value + '\n';
        });
        unusedStyles = new CleanCSS({
          all: false, // Disabled minification.
          format: 'beautify',
        }).minify(unusedStyles).styles;

        // Return back to action result.
        result.optimizedStyles = optimizedStyles;
        result.unusedStyles = unusedStyles;
      }

      let oldSize = oldStyles.length,
        newSize = optimizedStyles.length;
      let ratio = Math.round((oldSize - newSize) / oldSize * 100);
      message = `Removed ${ratio}% styles. (${oldSize} -> ${newSize} bytes)`;
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

  result.html = html;
  return result;
}

//add disclaimer watermark
//TODO: refactor disclaimer text to a static file
function addDisclaminerWatermark(html) {
  console.log("adding disclaimer");
  let bodyTag = html.match(/<body[^>]*>/);
  return bodyTag ? html.replace(bodyTag, bodyTag+"\n\n<!-- TO REMOVE: -->\n<div style='border:dotted red 3px;background-color: pink;padding: 5px 10px;font-size: 20px;display:block;opacity: 0.8;z-index: 10000;font-family: sans-serif;width: 75%;position: fixed;left: 50%; bottom:0;margin-left: -37.5%;''>This page is not productio-ready, yet <p style='font-size:14px'>Please manually resovle any validation errors by adding <b>#development=1</b> to end of the URL and checking outputs inside the Chrome Dev Tools console, <br>or running the validation on:  <a href='https://search.google.com/test/amp'>AMP test</a><br><a href='https://amp.dev/documentation/guides-and-tutorials/learn/validation-workflow/validate_amp'>Details about AMP validation</a><br><br>To remove this message, look for 'TO REMOVE' in the source code of this HTML and delete the line below</p></div>\n\n") : html;
}

async function amplifyFunc(browser, url, steps, argv, computedDimensions) {
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
  let response = await page.goto(url);
  let pageSource = await response.text();
  let pageContent = await page.content();
  computedDimensions.computedHeight = await page.$eval('body', (ele) => {
    let compStyles = window.getComputedStyle(ele);
    return compStyles.getPropertyValue('height');
  });
  computedDimensions.computedWidth = await page.$eval('body', (ele) => {
    let compStyles = window.getComputedStyle(ele);
    return compStyles.getPropertyValue('width');
  });
  sourceDom = new JSDOM(pageContent, {
    url: host
  }).window.document;
  let ampErrors = await validateAMP(pageContent);

  // Output initial HTML, screenshot and amp errors.
  await writeToFile(`steps/output-step-0.html`, pageContent);
  await page.screenshot({
    path: `output/${outputPath}/steps/output-step-0.png`,
    fullPage: true
  });
  await writeToFile(`steps/output-step-0-log.txt`, ampErrors.join('\n'));

  // Clear page.on listener.
  page.removeListener('response', collectStyles);

  let i = 1;
  let stepOutput = '';
  let html = beautifyHtml(sourceDom);
  let actionResult, optimizedStyles, unusedStyles, oldStyles;

  // Since puppeteer thinks were still on a public facing server
  // setting it to localhost will allow us to continue seeing
  // a page even with some errors!
  let server = httpServer.createServer({root:`output/${outputPath}/`});
  server.listen(port, '127.0.0.1', () => {
    console.log('Local server started!'.cyan);
  });
  response = await page.goto(`http://127.0.0.1:${port}`);

  if(!response.ok()){
    console.warn('Could not connect to local server with Puppeteer!');
  }

  for (let i = 0; i < steps.length; i++) {
    consoleOutputs = [];
    let step = steps[i];

    if (!step.actions || step.skip) continue;
    console.log(`Step ${i+1}: ${step.name}`.yellow);

    for (let j = 0; j < step.actions.length; j++) {
      let action = step.actions[j];

      try {
        // The sourceDom will be updated after each action.
        actionResult = await runAction(action, sourceDom, page);
        html = actionResult.html;
        optimizedStyles = actionResult.optimizedStyles;
        unusedStyles = actionResult.unusedStyles;

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

    if (optimizedStyles) {
      await writeToFile(`steps/output-step-${i+1}-optimized-css.css`,
        optimizedStyles);
    }
    if (unusedStyles) {
      await writeToFile(`steps/output-step-${i+1}-unused-css.css`,
        unusedStyles);
    }

    // Update page content with updated HTML.
    await page.setContent(html, {
      waitUntil: 'networkidle0',
    });

    // Take and save screenshot to file.
    // await page.waitFor(500);

    // Uncomment to see what the browser is seeing
    // await writeToFile(`steps/output-step-${i+1}-page-output.html`, await page.content());

    await page.screenshot({
      path: `output/${outputPath}/steps/output-step-${i+1}.png`,
      fullPage: true
    });

    await writeToFile(`steps/output-step-${i+1}-log.txt`, (ampErrors || []).join('\n'));

    // Print AMP validation result.
    ampErrors = await validateAMP(html, true /* printResult */ );
  }

  //Add the disclaimer watermark
  html = addDisclaminerWatermark(html);


  // need to make sure we close out the server that was used!
  await server.close();

  console.log('Local server closed!'.cyan);

  // Write final outcome to file.
  await writeToFile(`output-final.html`, html);
  await page.screenshot({
    path: `output/${outputPath}/output-final.png`,
    fullPage: true
  });
  await writeToFile(`output-final-log.txt`, (ampErrors || []).join('\n'));

  let shouldcompare = argv['shouldcompare'] ? argv['shouldcompare'] === 'true' : false;

  if(!shouldcompare) return;

  try{
    await compareImages(`output/${outputPath}/steps/output-step-0.png`,`output/${outputPath}/output-final.png`, `output/${outputPath}/output-difference.png`, computedDimensions.computedHeight, computedDimensions.computedWidth, page, 'output-final.png', server, `output/${outputPath}/output-replace.png`);
  } catch(error) {
    console.log('Not able to compare at this time, please create issue with following info: '.yellow, error);
  }
}

async function amplify(url, steps, argv) {
  let isHeadless = argv['headless'] ? argv['headless'] === 'true' : true;
  port = argv['port'] || port;

  // Start puppeteer.
  const browser = await puppeteer.launch({
    headless: isHeadless,
  });

  try {
    await amplifyFunc(browser, url, steps, argv, computedDimensions);
    console.log('Complete.'.green);

  } catch (e) {
    console.error(e);
    console.log('Complete with errors.'.yellow);

  } finally {
    if (browser) await browser.close();
  }
}

async function compareImages(image1Path, image2Path, diffPath, computedHeight, computedWidth, page, backgroundImage, server, replacementPath){
  const img1 = PNG.sync.read(fse.readFileSync(image1Path));
  let img2 = PNG.sync.read(fse.readFileSync(image2Path));

  let {width, height} = img1;
  if(img1.height > img2.height) {
    img2 = await resizeImage(computedHeight, computedWidth, backgroundImage, replacementPath, server, page);
  }
  const diff = new PNG({width,height});

  const mismatch = runComparison(img1.data, img2.data, diff, width, height);

  console.log(`Difference between original and converted: ${((mismatch/(width * height)) * 100).toFixed(2)}%`);

  fse.writeFileSync(diffPath, PNG.sync.write(diff));
}

async function resizeImage(height, width, imageLocation, replacementPath, server, page) {
  server = httpServer.createServer({root:`output/${outputPath}/`});
  await server.listen(port, '127.0.0.1', () => {
  });
  await page.goto(`http://127.0.0.1:${port}`);
  const newscreenshot = `
    <!DOCTYPE html>
    <html>
    <head>
    <meta name="viewport" content="width=device-width,minimum-scale=1,initial-scale=1">
    </head>
    <body style="padding:0;margin:0;">
    <div style="padding:0; margin:0; max-height:${height}; height:${height};width:${width};background:url(${imageLocation}) no-repeat; background-size: contain;">

    </div>
    </body>
    </html>
  `;
  await page.setContent(newscreenshot);
  // Uncomment if you want to debug
  await writeToFile(`output-replace.html`, await page.content());
  await page.screenshot({
    path: replacementPath,
    fullPage: true
  });
  await server.close();
  return PNG.sync.read(fse.readFileSync(replacementPath));
}

function runComparison(img1Data, img2Data, diff, width, height){
  return pixelmatch(img1Data, img2Data, diff.data, width, height, {threshold: 0.1});
}

module.exports = {
  amplify: amplify,
  runComparison,
  resizeImage,
  innerFunc: amplifyFunc
};
