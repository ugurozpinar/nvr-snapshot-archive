const path = require('node:path');
const { apiError, positive } = require('../validation');
const { cleanupRecent } = require('../../retention/compaction');

function register(app, deps) {
  const { repos, config, scheduler, nas } = deps;
  let cleaning = false;
  let saving = false;
  app.post('/api/cleanup', async (req, res) => {
    const days = positive(req.body.days, 'CLEANUP_DAYS');
    if (days > 36600) throw apiError('INVALID_CLEANUP_DAYS');
    if (cleaning) throw apiError('CLEANUP_BUSY', 409);
    cleaning = true;
    try {
      res.json(await (deps.runCleanup ? deps.runCleanup(days) : cleanupRecent(deps, days)));
    } finally {
      cleaning = false;
    }
  });
  app.get('/api/settings', (req, res) =>
    res.json(
      repos.settings.get('main') || {
        id: 'main',
        quotaBytes: null,
        spoolQuotaBytes: null,
        nasPath: null,
        compactionEnabled: false,
      },
    ),
  );
  async function saveSettings(req, res) {
    const old = repos.settings.get('main') || { id: 'main' },
      allowed = ['quotaBytes', 'spoolQuotaBytes', 'nasPath', 'compactionEnabled'];
    const update = {};
    for (const k of allowed) if (k in req.body) update[k] = req.body[k];
    const s = { ...old, ...update };
    if (s.quotaBytes != null) positive(s.quotaBytes, 'QUOTA', 20 * 1024 ** 2);
    if (s.spoolQuotaBytes != null) positive(s.spoolQuotaBytes, 'SPOOL_QUOTA', 20 * 1024 ** 2);
    if (s.nasPath) {
      if (typeof s.nasPath !== 'string' || !path.isAbsolute(s.nasPath))
        throw apiError('NAS_CONFIG_REQUIRED');
      s.nasPath = path.resolve(s.nasPath);
      if (
        [config.projectRoot, config.dataRoot].some(
          (root) =>
            s.nasPath === root ||
            s.nasPath.startsWith(root + path.sep) ||
            root.startsWith(s.nasPath + path.sep),
        )
      )
        throw apiError('NAS_MUST_BE_SEPARATE');
    } else s.nasPath = null;
    if (typeof s.compactionEnabled !== 'boolean' && s.compactionEnabled != null)
      throw apiError('INVALID_COMPACTION');
    if (
      ['nasPath', 'depotId', 'mountPoint', 'mountSource'].some((k) => s[k] !== old[k]) &&
      repos.images.stats().count
    )
      throw apiError('DEPOT_IN_USE', 409);
    const needsSetup =
      s.nasPath && (s.nasPath !== old.nasPath || !s.mountPoint || !s.mountSource || !s.depotId);
    const legacySetup =
      s.nasPath &&
      !needsSetup &&
      !old.nasSetupComplete &&
      repos.images.stats().count === repos.images.pendingStats().count;
    if (needsSetup || legacySetup) {
      try {
        Object.assign(
          s,
          await nas.request('configure', {
            settings: legacySetup ? s : { nasPath: s.nasPath },
          }),
        );
        s.nasSetupComplete = true;
      } catch (e) {
        if (!legacySetup || !['NAS_UNAVAILABLE', 'NAS_BUSY'].includes(e.code)) throw e;
      }
    }
    // Captures may finish while the worker checks the mount.
    if (s.nasPath !== old.nasPath && repos.images.stats().count)
      throw apiError('DEPOT_IN_USE', 409);
    s.compactionVersion =
      (old.compactionVersion || 0) + (s.compactionEnabled !== old.compactionEnabled ? 1 : 0);
    repos.settings.save(s);
    scheduler.refresh();
    res.json(s);
  }
  app.put('/api/settings', async (req, res) => {
    if (saving) throw apiError('NAS_BUSY', 409);
    saving = true;
    try {
      await saveSettings(req, res);
    } finally {
      saving = false;
    }
  });
  app.post('/api/nas/initialize', async (req, res) =>
    res.json(await nas.request('initialize', { settings: repos.settings.get('main') })),
  );
  app.post('/api/nas/test', async (req, res) =>
    res.json(await nas.request('health', { settings: repos.settings.get('main') })),
  );
}

module.exports = { register };
