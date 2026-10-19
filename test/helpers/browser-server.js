const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadConfig } = require('../../src/config');
const { openDatabase } = require('../../src/db/open');
const { createRepositories } = require('../../src/db/repositories');
const { createWebServer } = require('../../src/web/server');
const { createLocalStore } = require('../../src/archive/local-store');
const { createHistory } = require('../../src/history/service');
const { jpeg } = require('./context');
async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-browser-'));
  const config = loadConfig(
    {
      ARCHIVE_KEY: Buffer.alloc(32, 9).toString('hex'),
      SETUP_TOKEN: 'browser-token',
      DATA_DIR: dir,
    },
    path.resolve(__dirname, '../..'),
  );
  config.archiveRoot = path.join(dir, 'archive');
  const db = openDatabase(config.databasePath),
    repos = createRepositories(db);
  repos.settings.save({ id: 'main', quotaBytes: 1024 ** 3, compactionEnabled: false });
  repos.nvrs.save({ id: 'nvr', name: 'NVR Doğu', host: 'http://127.0.0.1', username: 'admin' });
  for (let i = 0; i < 90; i++)
    repos.cameras.save({
      id: 'cam' + i,
      nvrId: 'nvr',
      channel: i + 1,
      name: i === 0 ? 'Ana giriş' : 'Kamera ' + (i + 1),
      enabled: true,
      intervalMs: 900000,
      anchorMs: 3600000,
      masks: [],
      sensitivity: 'medium',
      policyVersion: 1,
    });
  const store = createLocalStore({ repos, config }),
    history = createHistory({ repos });
  const buffer = await jpeg('#3c6260', 800, 450);
  const job = history.beginCapture({ id: 'cam0' }, Date.parse('2026-10-19T12:00:00Z'));
  history.finishCapture(job, { status: 'success' });
  for (let i = 0; i < 4; i++)
    await store.persist({
      id: 'photo' + i,
      cameraId: 'cam0',
      capturedAt: Date.parse('2026-10-19T12:00:00Z') + i * 900000,
      buffer,
    });
  history.openPeriod('cam0', 'NVR_UNREACHABLE', {
    start: Date.parse('2026-10-19T08:00:00Z'),
    end: Date.parse('2026-10-19T09:00:00Z'),
  });
  const app = createWebServer({
    repos,
    config,
    store,
    history,
    scheduler: { refresh() {}, status: () => ({ running: 0, queued: 0 }) },
    nas: {
      status: () => ({ available: false }),
      request: async () => {
        throw Object.assign(Error(), { code: 'NAS_UNAVAILABLE' });
      },
    },
  });
  const server = app.listen(3099, '127.0.0.1');
  const stop = () => {
    server.closeAllConnections();
    server.close(() => {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
      process.exit(0);
    });
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
