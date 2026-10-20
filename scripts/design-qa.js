/* global document, window, innerWidth */
// Visual verification against production static assets, with an isolated test archive.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');
const sharp = require('sharp');

async function main() {
  const out = path.resolve(process.argv[2] || '.shots/pass-1');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'en-US',
  });
  await context.addInitScript(() => {
    window.designVitals = { lcp: 0, cls: 0 };
    new PerformanceObserver((list) => {
      window.designVitals.lcp = list.getEntries().at(-1).startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        if (!entry.hadRecentInput) window.designVitals.cls += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const reports = [];
  const screenshots = [];
  async function shot(name, fullPage = false) {
    await page.screenshot({ path: path.join(out, name + '.png'), fullPage });
    screenshots.push(name);
    const layout = await page.evaluate(() => ({
      overflowX: document.documentElement.scrollWidth > innerWidth,
      heading: [...document.querySelectorAll('h1')]
        .filter((e) => e.checkVisibility())
        .map((e) => e.textContent),
      vitals: window.designVitals,
    }));
    await page.evaluate(fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'));
    const a11y = await page.evaluate(async () => {
      const results = await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      });
      return results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      }));
    });
    reports.push({ name, ...layout, a11y });
  }
  await page.goto('http://127.0.0.1:3099/');
  await page.waitForSelector('#auth-submit');
  await page.waitForTimeout(300);
  await shot('d-auth');
  await page.locator('#auth-language').selectOption('en');
  const setup = page.locator('#setup-token');
  if (await setup.isVisible()) await setup.fill('browser-token');
  await page.locator('#password').fill('browser-password-123');
  await page.locator('#auth-submit').click();
  await page.locator('#camera-count').filter({ hasText: '90' }).waitFor();
  await page.waitForTimeout(650);
  await shot('d-status');
  await page.locator('#open-camera-archive').hover();
  await shot('h-archive-hover');
  await page.locator('[data-page="archive"]').click();
  await page.locator('#archive-date').fill('2026-10-19');
  await page.locator('#archive-filter button').click();
  await page.locator('.frame').first().waitFor();
  await page.waitForTimeout(450);
  await shot('d-archive', true);
  await page.locator('[data-page="settings"]').click();
  await page.waitForTimeout(600);
  await shot('d-settings', true);
  await page.locator('[data-page="status"]').click();
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(500);
  await shot('t-status');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await shot('m-status');
  await page.locator('.observation').scrollIntoViewIfNeeded();
  await shot('m-inspection');
  await page.locator('[data-page="archive"]').click();
  await page.waitForTimeout(500);
  await shot('m-archive', true);
  await page.locator('[data-page="settings"]').click();
  await page.waitForTimeout(600);
  await shot('m-settings', true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('[data-page="status"]').click();
  await shot('r-status');
  await page.keyboard.press('Tab');
  await shot('k-focus');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 200000,
    uploadThroughput: 93750,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.locator('#camera-count').filter({ hasText: '90' }).waitFor();
  await page.waitForTimeout(1200);
  await shot('m-throttled');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await page.locator('#logout').click();
  await page.locator('#auth-screen').waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await shot('m-auth');
  fs.writeFileSync(
    path.join(out, 'report.json'),
    JSON.stringify(
      {
        fixture:
          'Isolated browser archive: 90 test cameras, flat-color test images. No production data.',
        errors,
        reports,
      },
      null,
      2,
    ),
  );
  const thumbs = await Promise.all(
    screenshots.map(async (name, i) => {
      const buffer = await sharp(path.join(out, name + '.png'))
        .resize({ width: 360, height: 300, fit: 'contain', background: '#deded9' })
        .png()
        .toBuffer();
      return { input: buffer, left: (i % 3) * 360, top: Math.floor(i / 3) * 300 };
    }),
  );
  await sharp({
    create: {
      width: 1080,
      height: Math.ceil(thumbs.length / 3) * 300,
      channels: 3,
      background: '#deded9',
    },
  })
    .composite(thumbs)
    .png()
    .toFile(path.join(out, 'contact-sheet.png'));
  console.log(
    JSON.stringify(
      {
        out,
        errors,
        reports: reports.map(({ name, overflowX, a11y }) => ({
          name,
          overflowX,
          violations: a11y.map((v) => v.id),
        })),
      },
      null,
      2,
    ),
  );
  await browser.close();
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
