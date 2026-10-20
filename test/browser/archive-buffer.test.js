const { test, expect } = require('@playwright/test');

test('viewer keeps twenty originals ahead and crosses archive pages', async ({ page }) => {
  const cameras = [{ id: 'cam0', name: 'Camera', enabled: true, intervalMs: 900000 }];
  const originals = new Set();
  await page.route('**/api/session', (r) => r.fulfill({ json: { authenticated: true, csrf: 'test' } }));
  await page.route('**/api/cameras', (r) => r.fulfill({ json: cameras }));
  await page.route('**/api/nvrs', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/status', (r) => r.fulfill({ json: {
    cameras, storage: { bytes: 0, count: 0, pending: { bytes: 0, count: 0 } },
    nas: { available: false }, scheduler: {}, warnings: [],
  } }));
  await page.route('**/api/history?**', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/images/*/*', (r) => {
    const match = r.request().url().match(/images\/buffer(\d+)\/original/);
    if (match) originals.add(Number(match[1]));
    return r.fulfill({ path: 'public/favicon.svg', contentType: 'image/svg+xml' });
  });
  await page.route('**/api/images?**', (r) => {
    const start = Number(new URL(r.request().url()).searchParams.get('cursor') || 0);
    return r.fulfill({ json: {
      items: Array.from({ length: Math.min(48, 110 - start) }, (_, i) => ({
        id: 'buffer' + (start + i), capturedAt: Date.now() - (start + i) * 1000,
      })), nextCursor: start + 48 < 110 ? String(start + 48) : null,
    } });
  });
  await page.goto('/');
  await page.locator('[data-page="archive"]').click();
  await page.locator('#archive-camera').selectOption('cam0');
  await page.locator('#archive-filter').evaluate((form) => form.requestSubmit());
  await expect(page.locator('.frame')).toHaveCount(48);
  await page.locator('.frame').nth(47).click();
  await expect.poll(() => [...originals].filter((i) => i > 47 && i <= 67).length).toBe(20);
  await page.locator('#next-frame').click();
  await expect(page.locator('#viewer-image')).toHaveAttribute('src', '/api/images/buffer48/original');
  await page.locator('#previous-frame').click();
  await expect(page.locator('#viewer-image')).toHaveAttribute('src', '/api/images/buffer47/original');
  await page.locator('#close-viewer').click();
  await page.locator('.frame').nth(95).click();
  await expect(page.locator('.frame')).toHaveCount(110);
  for (let i = 96; i < 110; i++) await page.locator('#next-frame').click();
  await expect(page.locator('#next-frame')).toBeDisabled();
});
