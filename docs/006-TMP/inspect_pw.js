const { chromium } = require('playwright');

const urls = [
  ['SUPERAI', 'http://localhost:9301'],
  ['SUPERAI-login', 'http://localhost:9301/login'],
  ['APPHUB', 'http://localhost:9201'],
  ['ONTSTUDIO', 'http://localhost:9101'],
  ['DW', 'http://localhost:9401'],
  ['MCPHUB', 'http://localhost:9501'],
];

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
  } catch (e) {
    console.error('launch chrome channel failed:', e.message);
    try {
      browser = await chromium.launch({ headless: true });
    } catch (e2) {
      console.error('launch default failed:', e2.message);
      process.exit(1);
    }
  }
  for (const [name, url] of urls) {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', msg => logs.push(`${msg.type()}: ${msg.text()}`));
    page.on('pageerror', err => logs.push(`PAGEERROR: ${err.message}\n${err.stack}`));
    page.on('requestfailed', req => logs.push(`REQFAIL: ${req.url()} ${req.failure()?.errorText}`));
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    } catch (e) {
      logs.push(`GOTO ERROR: ${e.message}`);
    }
    await page.waitForTimeout(500);
    const rootHtml = await page.$eval('#root', el => el.innerHTML).catch(() => 'NO_ROOT');
    const bodyText = await page.$eval('body', el => el.innerText).catch(() => '');
    console.log(`\n=== ${name} (${url}) ===`);
    console.log('title:', await page.title());
    console.log('bodyText:', bodyText.slice(0, 200));
    console.log('rootLen:', rootHtml.length);
    console.log('logs:');
    logs.slice(0, 30).forEach(l => console.log('  ', l));
    if (rootHtml.length < 300) console.log('rootHTML:', rootHtml.slice(0, 500));
    await page.close();
  }
  await browser.close();
})();
