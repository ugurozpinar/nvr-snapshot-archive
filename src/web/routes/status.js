const { storageStats } = require('../../retention/capacity');

function register(app, deps) {
  const { repos, scheduler, nas } = deps;
  app.get('/api/status', async (req, res) => {
    let freeBytes = null;
    try {
      freeBytes = await deps.store.localSpace();
    } catch {}
    res.json({
      cameras: repos.cameras.list({ limit: 10000 }).map((camera) => {
        const [latest] = repos.images.recent(camera.id, 1);
        return { ...camera, latestImageId: latest?.id, latestImageAt: latest?.capturedAt };
      }),
      storage: storageStats(deps),
      nas: nas.status(),
      scheduler: scheduler.status(),
      localFreeBytes: freeBytes,
      runtime: deps.runtimeStatus?.() || {},
      warnings: [
        !repos.settings.get('main')?.quotaBytes ? 'QUOTA_REQUIRED' : null,
        !repos.settings.get('main')?.compactionEnabled ? 'COMPACTION_DISABLED' : null,
      ].filter(Boolean),
    });
  });
}

module.exports = { register };
