require('colors');
const { readFileSync, createReadStream, createWriteStream } = require('fs-extra');
const puppeteer = require('puppeteer');
const pixelmatch = require('pixelmatch');
const devices = require('puppeteer/DeviceDescriptors');
const { PNG } = require('pngjs');
const prototyper = require('../src/core');
const steps = require('../steps/default-steps');
const urlsToTest = [
  // Format: {url string, percentage of difference}
  {url:'https://www.thinkwithgoogle.com/', percentage: '0.00'},
  //{url:'https://www.dulcolax.com/', percentage: '23.57'},
  {url: 'https://www.ancestrydna.com/', percentage: '55.95'},
  // {url: 'https://www.newegg.com/', percentage: ''},
  // {url: 'https://www.libertymutual.com/', percentage: ''},
  // {url: 'https://www.wyndhamhotels.com/', percentage: ''},
  // {url: 'https://www.toyota.com/', percentage: ''},
  // {url: 'https://www.applebees.com/en/to-go', percentage: ''},
  // {url: 'https://www.nike.com/', percentage: ''},
  // {url: 'https://www.cargurus.com/', percentage: ''},
  // {url: 'https://www.phoenix.edu/', percentage: ''},
];

let computedDimensions = [];
let browser;

async function tests() {
  console.log('Converting sites....'.cyan);
  let size = urlsToTest.length;
  let pass = 0;
  browser = await puppeteer.launch();
  for (let [index, url] of urlsToTest.entries()) {
    computedDimensions.push({computedHeight:'', computedWidth: ''});
    await prototyper.innerFunc(browser, url.url, steps, { 'shouldcompare': 'false' }, computedDimensions[index]);
  }
  console.log('....Completed Conversion\n'.cyan);

  for (let [index, url] of urlsToTest.entries()) {
    console.log(`.......Running Test ${index + 1}`.cyan);
    console.log(`URL: ${url.url}`.cyan);
    console.log('Running though Prototyper'.cyan);
    let urlWithoutProtocol = url.url.replace(/http(s)?:\/\//ig, '');
    let outputPath = urlWithoutProtocol.replace(/\//ig, '_');

    const passed = await compareImages(`output/${outputPath}/output-original.png`, `output/${outputPath}/output-final.png`, `output/${outputPath}/output-temp.png`, computedDimensions[index], url.percentage);
    if (passed) {
      pass++;
    }
  }
  let message = `Passed ${pass}/${size}`;
  if (pass === size) {
    console.log(message.green);
    return;
  }
  console.log(message.red);
}



async function compareImages(image1Path, image2Path, tempPath, computedDimensions, expectedPercentage) {
  let img1 = PNG.sync.read(readFileSync(image1Path));
  let img2 = PNG.sync.read(readFileSync(image2Path));

  const page = await browser.newPage();
  await page.emulate(devices['Pixel 2']);


  let { width, height } = img1;

  if (img1.height !== img2.height) {
    img2 = await prototyper.resizeImage(computedDimensions.computedHeight, computedDimensions.computedWidth, 'output-final.png', tempPath, {}, page);
    console.debug("resizing img2");
  }

  return match(img1, img2, width, height, expectedPercentage);

}

function match(img1, img2, width, height, expectedPercentage) {
  const diff = new PNG({ width, height });

  const mismatch = prototyper.runComparison(img1.data, img2.data, diff, width, height);
  const percentage = ((mismatch / (width * height)) * 100).toFixed(2);

  if (percentage === expectedPercentage) {
    console.log(`Conversion passed`.green);
    return true;
  }

  console.log(`Conversion not within limits ${percentage}%`.red);
  return false;
}

Promise.all([
  tests()
]).then(process.exit)
.catch((reason) => {
  console.log(reason);
  process.exit();
});
