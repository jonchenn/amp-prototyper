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
  --fullPageScreenshot=(true|false*)\tWhether to save full-page screenshots.
  --compareScreenshots=(true|false*)\tWhether to compare original site with converted.
  --customHost=HOST\tUse a custom host name when updating relative asset URLs.
  --port=PORT_NUMBER\tPort number to use to compare before and after (defaults to 8080).

Examples:
  # Amplify a page and generate results in /output folder.
  ./amp-prototyper https://thinkwithgoogle.com

  # Amplify a page and generate results in /output/test folder.
  ./amp-prototyper https://thinkwithgoogle.com --output=test

  # Amplify a page with customized steps.
  ./amp-prototyper https://thinkwithgoogle.com --steps=custom/mysteps.js

  # Amplify a page and display AMP validation details.
  ./amp-prototyper https://thinkwithgoogle.com --verbose

  # Amplify a page and compare original site with converted.
  ./amp-prototyper https://thinkwithgoogle.com --compareScreenshots=true

  # Amplify a page and use a different port.
  ./amp-prototyper https://thinkwithgoogle.com --port=3000

  # Amplify a page that served from localhost and generate results with correct absolute URLs for assets.
  ./amp-prototyper https://thinkwithgoogle.com --customHost=https://example.com
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
