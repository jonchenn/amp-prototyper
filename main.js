const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');

const IMG_SELECTOR = 'amp-img';

async function run() {
  const browser = await puppeteer.launch({
    headless: false
  });
  const page = await browser.newPage();
  await page.emulate(devices['Pixel 2']);

  await page.goto('https://jonchen-lab.firebaseapp.com/amp.html');

  // let bodyHTML = await page.evaluate(() => document.body.innerHTML);
  let imgSrc = await page.evaluate((sel) => {
    return document.querySelector('amp-img').getAttribute('src');
  }, 'amp-img');

  await page.evaluate(() => {
     let dom = document.querySelector('body');
     dom.innerHTML = "change to something"
  });

  await page.screenshot({path: 'output/example.png'});
  await browser.close();
}

run();
