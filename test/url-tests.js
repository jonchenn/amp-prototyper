require('colors');
const fse = require('fs-extra');
const puppeteer = require('puppeteer');
const pixelmatch = require('pixelmatch');
const PNG = require('pngjs').PNG;
const prototyper = require('../src/core');
const steps = require('../steps/default-steps');
const urlsToTest = [
  //'https://www.thinkwithgoogle.com/',
  'https://www.dulcolax.com/',
  //'https://www.ancestrydna.com/',
  //'https://www.newegg.com/'
];

async function tests() {
  console.log('Converting sites....'.cyan);
  let size = urlsToTest.length;
  let pass = 0;
  // for (let [index, url ] of urlsToTest.entries()) {

  //   let urlWithoutProtocol = url.replace(/http(s)?:\/\//ig, '');
  //   let outputPath = urlWithoutProtocol.replace(/\//ig, '_');
  //   await prototyper.amplify(url, steps, { 'shouldcompare': 'false' });
  // }
  console.log('....Completed Conversion'.cyan);

  for (let [index, url ] of urlsToTest.entries()) {
    console.log(`.......Running Test ${index + 1}`.cyan);
    console.log(`URL: ${url}`.cyan);
    console.log('Running though Prototyper'.cyan);
    let urlWithoutProtocol = url.replace(/http(s)?:\/\//ig, '');
    let outputPath = urlWithoutProtocol.replace(/\//ig, '_');

    const passed = await compareImages(`output/${outputPath}/steps/output-step-0.png`, `output/${outputPath}/output-final.png`, `output/${outputPath}/output-temp.png`);
    if(passed){
      pass++;
    }
  }
  let message = `Passed ${pass}/${size}`;
  if(pass === size){
    console.log(message.green);
    return 1;
  }
  console.log(message.red);
  return 0;
}



async function compareImages(image1Path, image2Path, tempPath) {
  let img1 = PNG.sync.read(fse.readFileSync(image1Path));
  let img2 = PNG.sync.read(fse.readFileSync(image2Path));



  let { width, height } = img1;

  if(img1.height > img2.height) {
    height = img2.height;
    let temp = new PNG({width, height});
    await fse.createReadStream(image1Path)
      .pipe(new PNG())
      .on('parsed', function() {
        this.bitblt(temp, 0,0,width,height,0,0);
        temp.pack().pipe(fse.createWriteStream(tempPath));
      });
    img1 = PNG.sync.read(fse.readFileSync(tempPath));

    console.log(temp.width);
    console.log(temp.height);

    console.log(img2.width);
    console.log(img2.height);
  } else {
    return match(img1, img2, width, height);
  }

}

function match(img1, img2, width, height) {
  const diff = new PNG({ width, height });

  const mismatch = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });
  const percentage = (mismatch / (width * height)) * 100;

  if (percentage <= 5.0) {
    console.log(`Conversion passed`.green);
    return true;
  }

  console.log(`Conversion not withing limits ${percentage}`.red);
  return false;
}


tests();
