const { test, expect } = require('@playwright/test');
test('administrator browses archive, explains gaps and configures masks and intervals', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Kurulum anahtarı').fill('browser-token');
  await page.getByLabel('Yönetici parolası').fill('browser-password-123');
  await page.getByRole('button', { name: 'Yöneticiyi oluştur' }).click();
  await expect(page.getByRole('heading', { name: 'Arşivin nabzı' })).toBeVisible();
  await expect(page.getByTestId('camera-count')).toHaveText('90');
  await page.getByRole('button', { name: 'Arşiv', exact: true }).click();
  await page.getByRole('combobox', { name: 'Kamera', exact: true }).selectOption('cam0');
  await page.getByLabel('Tarih', { exact: true }).fill('2026-10-19');
  await page.getByRole('button', { name: 'Görüntüleri getir' }).click();
  await expect(page.locator('.frame')).toHaveCount(4);
  await page.locator('.frame').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Sonraki görüntü' }).click();
  await expect(page.getByRole('link', { name: 'Özgün görüntüyü indir' })).toHaveAttribute(
    'href',
    /photo1/,
  );
  await page.getByRole('button', { name: 'Kapat', exact: true }).click();
  await expect(page.getByText('NVR erişim hatası')).toBeVisible();
  await page.getByRole('button', { name: 'Ayarlar', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Düzenlenecek kamera', exact: true })
    .selectOption('cam0');
  await page.getByLabel('Çekim aralığı (dakika)').fill('10');
  await page.getByRole('button', { name: 'Kamerayı kaydet' }).click();
  await expect(page.getByRole('status')).toContainText('kaydedildi');
  await page.getByRole('button', { name: 'Son görüntüyü yükle' }).click();
  const canvas = page.locator('#mask-canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 45);
  await page.mouse.up();
  await expect(page.getByTestId('mask-count')).toHaveText('1 alan');
  await page.getByRole('button', { name: 'Kamerayı kaydet' }).click();
  await page.screenshot({ path: 'test-results/archive-settings.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Genel durum', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Arşivin nabzı' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Çıkış' }).click();
  await expect(page.getByRole('button', { name: 'Giriş yap' })).toBeVisible();
});
