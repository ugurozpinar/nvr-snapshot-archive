const fs = require('node:fs/promises');
const { loadConfig } = require('./config');
const { openDatabase } = require('./db/open');
const { createRepositories } = require('./db/repositories');
const { createLocalStore } = require('./archive/local-store');
const { createHistory } = require('./history/service');
const { createScheduler } = require('./capture/scheduler');
const { createNasSupervisor } = require('./nas/supervisor');
const { runTransfers, verifyPresence } = require('./nas/transfer');
const { compactCamera } = require('./retention/compaction');
const { recoverDeletes } = require('./retention/deletion');
const { enforceCapacity } = require('./retention/capacity');
const { createWebServer } = require('./web/server');
async function createApp(config = loadConfig(), overrides = {}) {
  for (const dir of [config.dataRoot, config.archiveRoot, config.spoolRoot, config.cacheRoot])
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const db = openDatabase(config.databasePath),
    repos = createRepositories(db);
  if (!repos.settings.get('main'))
    repos.settings.save({
      id: 'main',
      quotaBytes: null,
      spoolQuotaBytes: null,
      nasPath: null,
      compactionEnabled: false,
    });
  const store = createLocalStore({ repos, config }),
    history = createHistory({ repos });
  await store.reconcile();
  history.recoverStartup();
  const nas = overrides.nas || createNasSupervisor(),
    client = overrides.client || require('./capture/nvr-client');
  const deps = { repos, config, store, history, nas, client };
  const scheduler = createScheduler(deps);
  deps.scheduler = scheduler;
  const web = createWebServer(deps);
  let server = null,
    timers = [],
    maintenance = null,
    stopped = false,
    backgroundError = null;
  async function maintain() {
    if (stopped) return;
    const settings = repos.settings.get('main');
    if (settings?.nasPath) {
      try {
        const health = await nas.request('health', { settings });
        repos.settings.save({ id: 'nas-health', ...health });
        history.closeScope('nas');
      } catch (e) {
        if (e.code !== 'NAS_BUSY') history.openPeriod('nas', e.code || 'NAS_IO_ERROR');
        return;
      }
    }
    if (stopped) return;
    await runTransfers(deps);
    if (stopped) return;
    await recoverDeletes(deps);
    for (const c of repos.cameras.list({ limit: 10000 })) {
      if (stopped) return;
      await compactCamera(c.id, deps);
    }
    if (stopped) return;
    await enforceCapacity(deps);
    if (settings.nasPath && !stopped) {
      const progress = repos.settings.get('presence-cursor')?.after;
      const images = repos.images.list({ state: 'transferred', after: progress, limit: 20 });
      for (const image of images) {
        if (stopped) return;
        await verifyPresence(image.id, deps);
      }
      const last = images.at(-1);
      repos.settings.save({
        id: 'presence-cursor',
        after: images.length === 20 ? { time: last.capturedAt, id: last.id } : null,
      });
    }
    backgroundError = null;
  }
  function maintenanceTick() {
    if (maintenance || stopped) return;
    maintenance = maintain()
      .catch((e) => {
        backgroundError = e.code || 'MAINTENANCE_FAILED';
      })
      .finally(() => {
        maintenance = null;
      });
  }
  return {
    repos,
    store,
    history,
    scheduler,
    nas,
    web,
    maintenanceTick,
    status: () => ({ backgroundError }),
    address: () => server?.address(),
    async start() {
      if (server) return;
      server = await new Promise((resolve, reject) => {
        const s = web.listen(config.port, config.host, () => resolve(s));
        s.once('error', reject);
      });
      scheduler.start();
      timers = [
        setInterval(() => {
          try {
            history.heartbeat();
          } catch {
            backgroundError = 'DATABASE_UNHEALTHY';
          }
        }, 60000),
        setInterval(maintenanceTick, 10000),
      ];
      maintenanceTick();
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      timers.forEach(clearInterval);
      nas.stop?.();
      await scheduler.stop({ deadlineMs: 5000 });
      await maintenance;
      if (server) {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
      try {
        history.heartbeat(true);
      } finally {
        db.close();
      }
    },
  };
}
async function main() {
  const app = await createApp();
  await app.start();
  console.log(JSON.stringify({ event: 'listening', address: app.address() }));
  let shutting = false;
  const stop = async () => {
    if (shutting) return;
    shutting = true;
    const timer = setTimeout(() => process.exit(1), 10000);
    try {
      await app.stop();
      clearTimeout(timer);
      process.exit(0);
    } catch {
      process.exit(1);
    }
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
module.exports = { createApp, main };
if (require.main === module)
  main().catch((e) => {
    console.error(
      JSON.stringify({
        event: 'startup_failed',
        code: e.code || 'CONFIG_OR_LOCAL_STORAGE_ERROR',
        message: e.message?.startsWith('ARCHIVE_KEY') ? e.message : undefined,
      }),
    );
    process.exitCode = 1;
  });
