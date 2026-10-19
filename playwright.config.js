const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: 'test/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:3099', headless: true },
  webServer: {
    command: 'node test/helpers/browser-server.js',
    url: 'http://127.0.0.1:3099/api/session',
    reuseExistingServer: false,
  },
  reporter: 'list',
});
