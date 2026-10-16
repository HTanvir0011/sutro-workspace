'use strict';
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
(async () => {
  fs.mkdirSync('docs/implementation/screenshots', { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    // Block external CDNs during baseline: local synthetic fixtures only.
    await context.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:5173/') ? route.continue() : route.abort());
    const page = await context.newPage();
    for (const name of ['index','cases','intake','timeline','audit','report','about','models','ocr']) {
      const errors = [];
      const listener = error => errors.push(error.message);
      page.on('pageerror', listener);
      await page.goto(`http://127.0.0.1:5173/${name}.html`, { waitUntil: 'networkidle' });
      await page.screenshot({ path: `docs/implementation/screenshots/baseline-${name}-${width}.png`, fullPage: true });
      results.push({ page: name, width, errors, title: await page.title(), horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
      page.off('pageerror', listener);
    }
    await context.close();
  }
  fs.writeFileSync('docs/implementation/baseline-browser.json', JSON.stringify({ browser: browser.version(), results }, null, 2));
  await browser.close();
  console.log(JSON.stringify(results));
})().catch(error => { console.error(error); process.exitCode = 1; });
