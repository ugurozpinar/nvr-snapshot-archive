const { compareImages } = require('../../retention/similarity');
const { readImage } = require('../../nas/transfer');
const { createMedia } = require('../media');
const { apiError, positive, cleanImage, range } = require('../validation');

function register(app, deps) {
  const { repos, nas, history } = deps;
  const media = createMedia(deps);
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
        reverse: req.query.direction === 'backward',
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
}

module.exports = { register };
