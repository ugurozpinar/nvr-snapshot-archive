const { randomUUID } = require('node:crypto');
const { encryptSecret, decryptSecret } = require('../../security/secrets');
const { apiError, positive, cleanNvr } = require('../validation');

function register(app, deps) {
  const { repos, config } = deps;
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
}

module.exports = { register };
