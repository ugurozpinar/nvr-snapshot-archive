const { test, expect } = require('@playwright/test');

test('NAS settings saves a mounted folder without manual mount or identity fields', async ({
  page,
}) => {
  await page.route('**/api/session', (route) =>
    route.fulfill({ json: { authenticated: true, csrf: 'test' } }),
  );
  for (const endpoint of ['cameras', 'nvrs'])
    await page.route(`**/api/${endpoint}`, (route) => route.fulfill({ json: [] }));
  await page.route('**/api/status', (route) =>
    route.fulfill({
      json: {
        cameras: [],
        storage: { bytes: 0, count: 0, pending: { bytes: 0, count: 0 } },
        nas: { available: false },
        scheduler: {},
        warnings: [],
      },
    }),
  );
  let settings = { quotaBytes: 1024 ** 3, nasPath: null };
  await page.route('**/api/settings', async (route) => {
    if (route.request().method() === 'PUT') settings = route.request().postDataJSON();
    await route.fulfill({ json: settings });
  });
  await page.goto('/');
  await page.locator('[data-page="settings"]').click();
  await expect(page.locator('#quota')).toHaveValue('1');
  await page.locator('#nas-path').fill('/mnt/nas_paylasimi');
  const saved = page.waitForResponse(
    (response) => response.url().endsWith('/api/settings') && response.request().method() === 'PUT',
  );
  await page.locator('#storage-form button[type="submit"], #storage-form button.primary').click();
  await saved;
  expect(settings.nasPath).toBe('/mnt/nas_paylasimi');
  expect(settings.mountPoint).toBeUndefined();
  expect(settings.mountSource).toBeUndefined();
  expect(settings.depotId).toBeUndefined();
  await expect(page.locator('#mount-point, #mount-source, #depot-id, #init-nas')).toHaveCount(0);
  await page.locator('[data-page="status"]').click();
  await page.locator('[data-page="settings"]').click();
  await expect(page.locator('#nas-path')).toHaveValue('/mnt/nas_paylasimi');
});
