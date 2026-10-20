const { test, expect } = require('@playwright/test');

test('inspection selects a real capture and opens the matching dated archive', async ({ page }) => {
  const cameras = [
    { id: 'yard', name: 'Courtyard', enabled: true, intervalMs: 900000 },
    {
      id: 'entry',
      name: 'Entrance',
      enabled: true,
      intervalMs: 900000,
      latestImageId: 'photo0',
      lastSuccess: Date.parse('2026-10-20T12:00:00Z'),
      latestImageAt: Date.parse('2026-10-19T12:00:00Z'),
    },
  ];
  await page.route('**/api/session', (route) =>
    route.fulfill({ json: { authenticated: true, csrf: 'test' } }),
  );
  await page.route('**/api/cameras', (route) => route.fulfill({ json: cameras }));
  await page.route('**/api/nvrs', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/status', (route) =>
    route.fulfill({
      json: {
        cameras,
        storage: { bytes: 12000, quotaBytes: 1024 ** 3, count: 4, pending: { bytes: 0, count: 0 } },
        nas: { available: false },
        scheduler: {},
        warnings: [],
      },
    }),
  );
  await page.route('**/api/images/photo0/thumbnail', (route) =>
    route.fulfill({ path: 'public/favicon.svg', contentType: 'image/svg+xml' }),
  );
  await page.route('**/api/images?**', (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await page.route('**/api/history?**', (route) => route.fulfill({ json: [] }));
  await page.goto('/');
  await expect(page.locator('#capture-preview')).toBeVisible();
  await expect(page.locator('#capture-camera-name')).toHaveText('Entrance');
  await page.locator('#observation-camera').selectOption('yard');
  await expect(page.locator('#capture-preview')).toBeHidden();
  await expect(page.locator('#capture-empty')).toBeVisible();
  await page.locator('#observation-camera').selectOption('entry');
  const archiveRequest = page.waitForRequest((request) => request.url().includes('/api/images?'));
  await page.locator('#open-camera-archive').click();
  const request = await archiveRequest;
  expect(new URL(request.url()).searchParams.get('cameraId')).toBe('entry');
  await expect(page.locator('#archive-date')).toHaveValue('2026-10-19');
  await expect(page.locator('#page-archive')).toBeVisible();
});
