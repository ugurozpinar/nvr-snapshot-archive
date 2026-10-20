const { randomUUID } = require('node:crypto');
const { validateMasks } = require('../../retention/similarity');
const { apiError, positive, cleanImage } = require('../validation');

function register(app, deps) {
  const { repos, scheduler, nas, history } = deps;
  app.get('/api/cameras', (req, res) => res.json(repos.cameras.list({ limit: 10000 })));
  app.get('/api/cameras/:id/recent', (req, res) => {
    res.json(repos.images.recent(req.params.id).map((image) => cleanImage(image, nas)));
  });
  function cameraInput(body, old) {
    const row = {
      id: old?.id || randomUUID(),
      enabled: true,
      intervalMs: 900000,
      anchorMs: 3600000,
      masks: [],
      sensitivity: 'medium',
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
    if (typeof row.enabled !== 'boolean' || !['low', 'medium', 'high'].includes(row.sensitivity))
      throw apiError('INVALID_CAMERA');
    validateMasks(row.masks);
    if (
      old &&
      ['masks', 'sensitivity', 'anchorMs'].some(
        (k) => JSON.stringify(row[k]) !== JSON.stringify(old[k]),
      )
    ) {
      row.policyVersion = (old.policyVersion || 1) + 1;
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
}

module.exports = { register };
