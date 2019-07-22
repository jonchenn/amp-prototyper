const {amplify} = require('./core');
const argv = require('minimist')(process.argv.slice(2));
const steps = require('../steps/default-steps.js')

function printUsage() {
  let usage = `
Usage: ./amp-prototyper [URL]

Required:
  URL\tURL to the page to convert.

Options (*denotes default value if not passed in):
  --steps=FILE\tPath to the custom steps JS file. If not defined, it will use ./steps/default-steps.js
  --output=FILE\tPath to the output file.
  --device=DEVICE_NAME\tUse specific device name for screenshots.
  --headless=(true*|false)\tWhether to show browser.
  --verbose\tDisplay AMP validation errors.
  --pixelCompare=(true|false*)\tWhether to compare pixel to pixel original site with converted
  --port=PORT_NUMBER\tPort number to use to compare before and after (defaults to 8080)

Examples:
  # AMPlify a page and generate results in /output folder.
  ./amp-prototyper http://127.0.0.1:8080

  # AMPlify a page and generate results in /output/test folder.
  ./amp-prototyper http://127.0.0.1:8080 --output=test

  # AMPlify a page with customized steps.
  ./amp-prototyper http://127.0.0.1:8080 --steps=custom/mysteps.js

  # AMPlify a page and display AMP validation details.
  ./amp-prototyper http://127.0.0.1:8080 --verbose

  # AMPlify a page and compare original site with converted.
  ./amp-prototyper http://127.0.0.1:8080 --pixelCompare=true

  # AMPlify a page and use a different port.
  ./amp-prototyper http://127.0.0.1:8080 --port=3000
  `;
  console.log(usage);
}

/**
 * Main CLI function.
 */
async function begin() {
  let url = argv['_'][0], output = argv['output'];
  let customSteps = argv['steps'] ?
      require(`../${argv['steps']}`) : null;

  if (!url) {
    printUsage();
    return;
  }

  let allSteps = customSteps || steps;
  if (customSteps) console.log(`Use custom steps ${argv['steps']}`);

  await amplify(url, allSteps, argv);
}

module.exports = {
  begin,
};
