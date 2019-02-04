const {amplify} = require('./src/easy-amplify-core');
const argv = require('minimist')(process.argv.slice(2));
const steps = require('./src/default-steps.js')

function printUsage() {
  let usage = `
Usage: node run.js --url=[URL]

Required:
  --url=URL\tURL to the page to convert.

Options:
  --steps=FILE\tPath to the custom steps JS file.
  --moreSteps=FILE\tPath to the more steps JS file.
  --output=FILE\tPath to the output file.
  --verbose\tDisplay AMP validation errors.
  `;
  console.log(usage);
}

let url = argv['url'], output = argv['output'];
let customSteps = argv['steps'] ?
    require(`./${argv['steps']}`) : null;
let moreSteps = argv['moreSteps'] ?
    require(`./${argv['moreSteps']}`) : null;

if (!url) {
  printUsage();
  return;
}

let allSteps = customSteps || steps;
if (moreSteps) allSteps = allSteps.concat(moreSteps);

if (customSteps) console.log(`Use custom steps ${argv['steps']}`);

amplify(url, allSteps, argv);
