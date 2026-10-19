const path = require('node:path');
const { apiError, positive } = require('../validation');

function register(app, deps) {
  const { repos, config, scheduler, nas } = deps;
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
  app.put('/api/settings', (req, res) => {
    const old = repos.settings.get('main') || { id: 'main' },
      allowed = [
        'quotaBytes',
        'spoolQuotaBytes',
        'nasPath',
        'mountPoint',
        'mountSource',
        'depotId',
        'compactionEnabled',
      ];
    const update = {};
    for (const k of allowed) if (k in req.body) update[k] = req.body[k];
    const s = { ...old, ...update };
    if (s.quotaBytes != null) positive(s.quotaBytes, 'QUOTA', 20 * 1024 ** 2);
    if (s.spoolQuotaBytes != null) positive(s.spoolQuotaBytes, 'SPOOL_QUOTA', 20 * 1024 ** 2);
    if (s.nasPath) {
      if (
        typeof s.nasPath !== 'string' ||
        !path.isAbsolute(s.nasPath) ||
        !s.mountPoint ||
        !s.mountSource ||
        !s.depotId
      )
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
      if (
        typeof s.mountPoint !== 'string' ||
        !path.isAbsolute(s.mountPoint) ||
        typeof s.mountSource !== 'string' ||
        typeof s.depotId !== 'string' ||
        !/^[\w-]{3,100}$/.test(s.depotId)
      )
        throw apiError('NAS_CONFIG_REQUIRED');
    } else s.nasPath = null;
    if (typeof s.compactionEnabled !== 'boolean' && s.compactionEnabled != null)
      throw apiError('INVALID_COMPACTION');
    if (
      ['nasPath', 'depotId', 'mountPoint', 'mountSource'].some((k) => s[k] !== old[k]) &&
      repos.images.stats().count
    )
      throw apiError('DEPOT_IN_USE', 409);
    s.compactionVersion =
      (old.compactionVersion || 0) + (s.compactionEnabled !== old.compactionEnabled ? 1 : 0);
    repos.settings.save(s);
    scheduler.refresh();
    res.json(s);
  });
  app.post('/api/nas/initialize', async (req, res) =>
    res.json(await nas.request('initialize', { settings: repos.settings.get('main') })),
  );
  app.post('/api/nas/test', async (req, res) =>
    res.json(await nas.request('health', { settings: repos.settings.get('main') })),
  );
}

module.exports = { register };
