const express = require('express');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createAuth } = require('../security/auth');
const { encryptSecret, decryptSecret } = require('../security/secrets');
const { storageStats } = require('../retention/capacity');
const { validateMasks, compareImages } = require('../retention/similarity');
const { readImage } = require('../nas/transfer');
const { createMedia } = require('./media');
const { dayStart } = require('../history/service');
function apiError(code, status = 400) {
  return Object.assign(Error(code), { code, status });
}
function positive(value, name, min = 1) {
  if (!Number.isSafeInteger(value) || value < min) throw apiError('INVALID_' + name);
  return value;
}
function cleanNvr(n) {
  const { secret, password, ...safe } = n;
  return safe;
}
function cleanImage(i, nas) {
  const { localPath, nasPath, relativePath, absentTours, ...safe } = i;
  return {
    ...safe,
    availability:
      i.state === 'transferred' && !nas.status().available && i.availability !== 'missing'
        ? 'unavailable'
        : i.availability,
  };
}
function range(query) {
  if (query.day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query.day) || !Number.isFinite(dayStart(query.day)))
      throw apiError('INVALID_DATE');
    const from = dayStart(query.day);
    return { from, to: from + 86400000 };
  }
  const from = query.from == null ? 0 : Number(query.from),
    to = query.to == null ? Date.now() + 1 : Number(query.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) throw apiError('INVALID_DATE');
  return { from, to };
}
function createWebServer(deps) {
  const { repos, config, scheduler, nas, history } = deps,
    app = express(),
    auth = createAuth(deps),
    media = createMedia(deps);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '128kb' }));
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    });
    if (req.path.startsWith('/api')) res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/session', (req, res) => res.json(auth.info(req)));
  app.post('/api/setup', auth.setup);
  app.post('/api/login', auth.login);
  app.use('/api', auth.require);
  app.post('/api/logout', auth.logout);
  app.get('/api/status', async (req, res) => {
    let freeBytes = null;
    try {
      freeBytes = await deps.store.localSpace();
    } catch {}
    res.json({
      cameras: repos.cameras.list({ limit: 10000 }).map((camera) => {
        const latest = repos.db
          .prepare(
            "SELECT id,json_extract(data,'$.capturedAt') capturedAt FROM images WHERE json_extract(data,'$.cameraId')=? ORDER BY json_extract(data,'$.capturedAt') DESC,id DESC LIMIT 1",
          )
          .get(camera.id);
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
  app.get('/api/nvrs', (req, res) => res.json(repos.nvrs.list().map(cleanNvr)));
  function saveNvr(req, res) {
    const old = req.params.id ? repos.nvrs.get(req.params.id) : null;
    if (req.params.id && !old) throw apiError('NOT_FOUND', 404);
    const b = req.body,
      n = { ...old, id: old?.id || randomUUID() };
    for (const k of ['name', 'host', 'username']) if (k in b) n[k] = b[k];
    if (
      ![n.name, n.host, n.username].every(
        (v) => typeof v === 'string' && v.length > 0 && v.length < 300,
      )
    )
      throw apiError('INVALID_NVR');
    let url;
    try {
      url = new URL(n.host.includes('://') ? n.host : 'http://' + n.host);
    } catch {
      throw apiError('INVALID_NVR_HOST');
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      throw apiError('INVALID_NVR_HOST');
    n.host = url.origin;
    if (b.password) {
      if (typeof b.password !== 'string' || b.password.length > 1024)
        throw apiError('INVALID_PASSWORD');
      n.secret = encryptSecret(b.password, config.key);
    }
    if (!n.secret) throw apiError('PASSWORD_REQUIRED');
    repos.nvrs.save(n);
    res.json(cleanNvr(n));
  }
  app.post('/api/nvrs', saveNvr);
  app.put('/api/nvrs/:id', saveNvr);
  app.delete('/api/nvrs/:id', (req, res) => {
    if (repos.cameras.list({ nvrId: req.params.id }).length) throw apiError('NVR_IN_USE', 409);
    repos.nvrs.remove(req.params.id);
    res.json({ ok: true });
  });
  app.post('/api/nvrs/:id/test', async (req, res) => {
    const n = repos.nvrs.get(req.params.id);
    if (!n) throw apiError('NOT_FOUND', 404);
    const { buffer } = await deps.client.captureSnapshot({
      nvr: { ...n, password: decryptSecret(n.secret, config.key) },
      channel: positive(Number(req.body.channel || 1), 'CHANNEL'),
    });
    res.json({ ok: true, bytes: buffer.length });
  });
  app.get('/api/cameras', (req, res) => res.json(repos.cameras.list({ limit: 10000 })));
  app.get('/api/cameras/:id/recent', (req, res) => {
    const rows = repos.db
      .prepare(
        "SELECT data FROM images WHERE json_extract(data,'$.cameraId')=? ORDER BY json_extract(data,'$.capturedAt') DESC,id DESC LIMIT 20",
      )
      .all(req.params.id);
    res.json(rows.map((r) => cleanImage(JSON.parse(r.data), nas)));
  });
  function cameraInput(body, old) {
    const row = {
      id: old?.id || randomUUID(),
      enabled: true,
      intervalMs: 900000,
      anchorMs: 3600000,
      masks: [],
      sensitivity: 'medium',
      calibrated: false,
      policyVersion: 1,
      ...old,
    };
    for (const k of [
      'name',
      'nvrId',
      'channel',
      'enabled',
      'intervalMs',
      'anchorMs',
      'masks',
      'sensitivity',
      'calibrated',
    ])
      if (k in body) row[k] = body[k];
    if (
      !repos.nvrs.get(row.nvrId) ||
      typeof row.name !== 'string' ||
      !row.name.trim() ||
      row.name.length > 200
    )
      throw apiError('INVALID_CAMERA');
    positive(row.channel, 'CHANNEL');
    if (row.channel > 1024) throw apiError('INVALID_CHANNEL');
    positive(row.intervalMs, 'INTERVAL', 1000);
    positive(row.anchorMs, 'ANCHOR', row.intervalMs);
    if (
      typeof row.enabled !== 'boolean' ||
      typeof row.calibrated !== 'boolean' ||
      !['low', 'medium', 'high'].includes(row.sensitivity)
    )
      throw apiError('INVALID_CAMERA');
    validateMasks(row.masks);
    if (
      old &&
      ['masks', 'sensitivity', 'anchorMs'].some(
        (k) => JSON.stringify(row[k]) !== JSON.stringify(old[k]),
      )
    ) {
      row.policyVersion = (old.policyVersion || 1) + 1;
      row.calibrated = false;
    }
    return row;
  }
  app.post('/api/cameras', (req, res) => {
    const c = cameraInput(req.body);
    repos.transaction(() => {
      repos.cameras.save(c);
      history.settingChanged(c);
    });
    scheduler.refresh();
    res.json(c);
  });
  app.post('/api/cameras/bulk', (req, res) => {
    const first = positive(req.body.first, 'FIRST_CHANNEL'),
      last = positive(req.body.last, 'LAST_CHANNEL');
    if (last < first || last - first >= 128) throw apiError('INVALID_RANGE');
    const rows = [];
    repos.transaction(() => {
      for (let channel = first; channel <= last; channel++) {
        const c = cameraInput({
          ...req.body,
          channel,
          name: `${req.body.name || 'Kamera'} ${channel}`,
        });
        repos.cameras.save(c);
        history.settingChanged(c);
        rows.push(c);
      }
    });
    scheduler.refresh();
    res.json(rows);
  });
  app.put('/api/cameras/:id', (req, res) => {
    const old = repos.cameras.get(req.params.id);
    if (!old) throw apiError('NOT_FOUND', 404);
    const c = cameraInput(req.body, old);
    repos.transaction(() => {
      repos.cameras.save(c);
      history.settingChanged(c);
    });
    scheduler.refresh();
    res.json(c);
  });
  app.post('/api/cameras/:id/copy-masks', (req, res) => {
    if (!repos.cameras.get(req.params.id)) throw apiError('NOT_FOUND', 404);
    const masks = req.body.masks;
    validateMasks(masks);
    if (!Array.isArray(masks) || !masks.length) throw apiError('EMPTY_MASKS');
    const rows = repos.cameras.list({ limit: 10000 });
    let updated = 0;
    repos.transaction(() => {
      for (const old of rows) {
        if (JSON.stringify(old.masks || []) === JSON.stringify(masks)) continue;
        const camera = cameraInput({ masks }, old);
        repos.cameras.save(camera);
        history.settingChanged(camera);
        updated++;
      }
    });
    res.json({ updated, total: rows.length });
  });
  app.delete('/api/cameras/:id', (req, res) => {
    if (repos.images.list({ cameraId: req.params.id, limit: 1 }).length)
      throw apiError('CAMERA_HAS_ARCHIVE_DISABLE_INSTEAD', 409);
    repos.cameras.remove(req.params.id);
    scheduler.refresh();
    res.json({ ok: true });
  });
  app.get('/api/images', (req, res) => {
    const bounds = range(req.query);
    let after = null;
    if (req.query.cursor)
      try {
        after = JSON.parse(Buffer.from(req.query.cursor, 'base64url').toString());
        if (!Number.isFinite(after.time) || typeof after.id !== 'string') throw Error();
      } catch {
        throw apiError('INVALID_CURSOR');
      }
    const limit = Math.min(positive(Number(req.query.limit || 48), 'LIMIT'), 100);
    const items = repos.images.list({
        ...bounds,
        ...(req.query.cameraId ? { cameraId: req.query.cameraId } : {}),
        after,
        limit: limit + 1,
      }),
      more = items.length > limit;
    items.splice(limit);
    const last = items.at(-1);
    res.json({
      items: items.map((i) => cleanImage(i, nas)),
      nextCursor: more
        ? Buffer.from(JSON.stringify({ time: last.capturedAt, id: last.id })).toString('base64url')
        : null,
    });
  });
  app.get('/api/history', (req, res) => {
    if (!req.query.cameraId) throw apiError('CAMERA_REQUIRED');
    const { from, to } = range(req.query);
    res.json(history.query(req.query.cameraId, from, to));
  });
  app.get('/api/images/:id/:kind', async (req, res) => {
    if (!/^[\w-]+$/.test(req.params.id) || !['original', 'thumbnail'].includes(req.params.kind))
      throw apiError('NOT_FOUND', 404);
    if (!repos.images.get(req.params.id)) throw apiError('NOT_FOUND', 404);
    const b = await media[req.params.kind](req.params.id);
    res.type('jpg');
    if (req.query.download === '1') res.attachment(req.params.id + '.jpg');
    res.send(b);
  });
  app.post('/api/cameras/:id/compare', async (req, res) => {
    const c = repos.cameras.get(req.params.id);
    if (!c) throw apiError('NOT_FOUND', 404);
    const ids = [req.body.first, req.body.second];
    if (ids.some((id) => repos.images.get(id)?.cameraId !== c.id))
      throw apiError('CAMERA_IMAGE_MISMATCH');
    const [a, b] = await Promise.all(ids.map((id) => readImage(id, deps)));
    res.json({ ...(await compareImages(a, b, c)), policyVersion: c.policyVersion });
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
  app.use(express.static(path.join(config.projectRoot, 'public')));
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const code = err.code || 'INTERNAL_ERROR';
    const status =
      err.status ||
      (['NAS_UNAVAILABLE', 'NAS_BUSY', 'NAS_REQUIRED', 'NAS_SPACE_LOW'].includes(code)
        ? 503
        : [
              'AUTH_FAILED',
              'NVR_UNREACHABLE',
              'NVR_HTTP_ERROR',
              'INVALID_IMAGE',
              'IMAGE_TOO_LARGE',
            ].includes(code)
          ? 502
          : code === 'CAPTURE_TIMEOUT'
            ? 504
            : code.startsWith('SQLITE_CONSTRAINT')
              ? 409
              : code === 'ENOENT'
                ? 404
                : code === 'INVALID_MASK'
                  ? 400
                  : 500);
    res.status(status).json({ error: status === 500 ? 'INTERNAL_ERROR' : code });
  });
  return app;
}
module.exports = { createWebServer, range, cleanImage };
