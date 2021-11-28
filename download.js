const puppeteer = require('puppeteer');
const fs = require('fs');
const request = require('request');
const browserParams = {
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  headless: true,
  slowMo: 100,
  defaultViewport: {
    width: 1440,
    height: 900,
  },
}

const getStamps = async(urls) => {
  const imageUrls = []
  for(let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const browser = await puppeteer.launch(browserParams);
    const page = await browser.newPage();
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.waitForSelector('header.LyHead', {visible: true});
    const images = await page.$$eval('.mdCMN09LiInner > .mdCMN09Image', list => list.map(span => span.style.backgroundImage.slice(5).slice(0,-2)));
    imageUrls.push(images);
    await browser.close();
    await sleep(3000);
  }
  return imageUrls
}

const uploadImageToGCS = async(image, stampNum, imageNum) => {
  const response = await syncRequest({
    url: image,
    method: 'GET',
    encoding: null,
  });
  const stampZeroNum = toDoubleDigits(stampNum);
  const imageZeroNum = toDoubleDigits(imageNum);
  const stampFileName = `line-${stampZeroNum}-${imageZeroNum}.png`;
  fs.writeFileSync(`./images/${stampZeroNum}/${stampFileName}`, new Buffer.from(response), 'binary');
}

const syncRequest = async(options) => {
  return new Promise((resolve, reject) => {
    request(options, (error, res, body) => {
      if (!error && res.statusCode == 200) {
        resolve(body);
      } else {
        reject(error);
      }
    })
  })
}

const toDoubleDigits = (num) => {
  num += "";
  return num.length === 1 ? `0${num}` : num;
}

const sleep = async (ms) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, ms)
  })
}

;(async () => {
  const csv = fs.readFileSync('url.csv', 'utf8');
  var urls = csv.toString().split(/\r\n|\n|\r/g);
  const stamps = await getStamps(urls);
  for(let i = 1;i <= stamps.length;i++) {
    const images = stamps[i - 1];
    var dir = `./images/${toDoubleDigits(i)}`;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, 0755);
    }
    for(let j = 1;j <= images.length;j++) {
      const image = images[j - 1];
      await uploadImageToGCS(image, i, j);
      await sleep(1000);
    }
  }
  process.exit(0)
})()
