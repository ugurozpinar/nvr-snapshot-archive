const { test, expect } = require('@playwright/test');

test('language detection, live switching and persistence work before login', async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: 'pt-PT' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.locator('#auth-submit')).toHaveText(/Entrar|Criar administrador/);
  await page.locator('#password').fill('unfinished-password');
  await page.locator('#auth-language').selectOption('tr');
  await expect(page.locator('#password')).toHaveValue('unfinished-password');
  await expect(page.locator('#auth-submit')).toHaveText(/Giriş yap|Yöneticiyi oluştur/);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  await context.close();
});

test('unsupported browser languages fall back to English even without local storage', async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: 'de-DE' });
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw Error('unavailable');
      },
    });
  });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('#auth-language').selectOption('pt-BR');
  await expect(page.locator('#auth-submit')).toHaveText(/Entrar|Criar administrador/);
  await context.close();
});

test('administrator can use archive, errors and settings in all three languages', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#auth-language').selectOption('en');
  const session = await (await page.request.get('/api/session')).json();
  if (session.setupRequired) await page.locator('#setup-token').fill('wrong-token');
  await page.locator('#password').fill('wrong-password-123');
  await page.locator('#auth-submit').click();
  await expect(page.locator('#auth-error')).toHaveText(
    session.setupRequired ? 'Incorrect setup token' : 'Incorrect password',
  );
  await page.locator('#auth-language').selectOption('pt-BR');
  await expect(page.locator('#auth-error')).toHaveText(
    session.setupRequired ? 'Chave de configuração incorreta' : 'Senha incorreta',
  );
  await page.locator('#auth-language').selectOption('en');
  if (session.setupRequired) await page.locator('#setup-token').fill('browser-token');
  await page.locator('#password').fill('browser-password-123');
  await page.locator('#auth-submit').click();
  await expect(page.getByRole('heading', { name: 'Archive overview' })).toBeVisible();
  await page.locator('[data-page="archive"]').click();
  await page.locator('#archive-camera').selectOption('cam0');
  await page.locator('#archive-date').fill('2026-10-19');
  await page.locator('#archive-filter button').click();
  await expect(page.locator('.frame')).toHaveCount(4);
  await expect(page.locator('.frame .caption').first()).toContainText('10/19/26');
  await expect(page.locator('#history-list')).toContainText('NVR connection error');
  await expect(page.locator('#history-list')).toContainText('10/19/26 · Planned');
  await page.locator('#app-language').selectOption('pt-BR');
  await expect(page.getByRole('heading', { name: 'Arquivo de imagens' })).toBeVisible();
  await expect(page.locator('#history-list')).toContainText('Erro de conexão com o NVR');
  await expect(page.locator('#history-list')).toContainText('19/10/2026 · Planejadas');
  await expect(page.locator('.frame .caption').first()).toContainText('19/10/2026');
  await page.locator('.frame').first().click();
  await expect(page.locator('#download-frame')).toHaveText('Baixar imagem original');
  await page.locator('#close-viewer').click();
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/api/cameras')),
    page.locator('[data-page="settings"]').click(),
  ]);
  await page.locator('#edit-camera').selectOption('cam0');
  await page.locator('#camera-interval').fill('12');
  await page.locator('#app-language').selectOption('tr');
  await expect(page.locator('#camera-interval')).toHaveValue('12');
  await expect(page.getByRole('button', { name: 'Kamerayı kaydet', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
