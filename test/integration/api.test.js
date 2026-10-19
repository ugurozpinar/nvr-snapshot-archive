const { test } = require('node:test');
const assert = require('node:assert/strict');
const { context, jpeg } = require('../helpers/context');
async function apiContext(t) {
  const { createWebServer } = require('../../src/web/server');
  const { createLocalStore } = require('../../src/archive/local-store');
  const { createHistory } = require('../../src/history/service');
  const ctx = context(t),
    store = createLocalStore(ctx),
    history = createHistory(ctx);
  const app = createWebServer({
    ...ctx,
    store,
    history,
    scheduler: { refresh() {}, status: () => ({}) },
    nas: {
      status: () => ({ available: false }),
      request: async () => {
        throw Object.assign(Error(), { code: 'NAS_UNAVAILABLE' });
      },
    },
  });
  const server = await new Promise((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  let cookie = '',
    csrf = '';
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(url, body, method = body ? 'POST' : 'GET', extra = {}) {
    const res = await fetch(base + url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        'X-CSRF-Token': csrf,
        ...extra,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
    const result = (res.headers.get('content-type') || '').includes('json')
      ? await res.json()
      : await res.arrayBuffer();
    if (result.csrf) csrf = result.csrf;
    return { status: res.status, data: result };
  }
  return { ...ctx, store, history, request };
}
test('authenticated API enforces setup, CSRF, hidden credentials and camera validation', async (t) => {
  const c = await apiContext(t),
    q = c.request;
  assert.equal((await q('/api/status')).status, 401);
  assert.equal(
    (await q('/api/setup', { token: 'wrong', password: 'long-enough-password' })).status,
    403,
  );
  assert.equal(
    (await q('/api/setup', { token: 'test-setup', password: 'long-enough-password' })).status,
    200,
  );
  assert.equal(
    (await q('/api/settings', { quotaBytes: 123 }, 'PUT', { 'X-CSRF-Token': 'bad' })).status,
    403,
  );
  const n = (
    await q('/api/nvrs', {
      name: 'NVR',
      host: 'http://127.0.0.1',
      username: 'admin',
      password: 'private-secret',
    })
  ).data;
  assert.equal(n.password, undefined);
  assert.equal(n.secret, undefined);
  assert.ok(!JSON.stringify((await q('/api/nvrs')).data).includes('private-secret'));
  const camera = (await q('/api/cameras', { name: 'Giriş', nvrId: n.id, channel: 1 })).data;
  assert.equal(camera.intervalMs, 900000);
  assert.equal(camera.enabled, true);
  assert.equal((await q(`/api/cameras/${camera.id}`, { intervalMs: 0 }, 'PUT')).status, 400);
  assert.equal(
    (await q(`/api/cameras/${camera.id}`, { masks: [{ x: 0, y: 0, width: 1, height: 1 }] }, 'PUT'))
      .status,
    400,
  );
  assert.equal((await q(`/api/nvrs/${n.id}`, null, 'DELETE')).status, 409);
  assert.equal((await q('/api/logout', {})).status, 200);
  assert.equal((await q('/api/status')).status, 401);
  assert.equal((await q('/api/login', { password: 'bad' })).status, 401);
  assert.equal((await q('/api/login', { password: 'long-enough-password' })).status, 200);
});
test('archive paginates tied timestamps, observes Istanbul dates and reads local pending image', async (t) => {
  const c = await apiContext(t),
    q = c.request;
  await q('/api/setup', { token: 'test-setup', password: 'long-enough-password' });
  const time = Date.parse('2026-10-19T21:30:00Z');
  for (const id of ['a', 'b', 'c'])
    await c.store.persist({ id, cameraId: 'cam', capturedAt: time, buffer: await jpeg() });
  const first = (await q('/api/images?cameraId=cam&day=2026-10-20&limit=2')).data;
  assert.equal(first.items.length, 2);
  assert.equal(first.items[0].localPath, undefined);
  const second = (
    await q(
      '/api/images?cameraId=cam&day=2026-10-20&limit=2&cursor=' +
        encodeURIComponent(first.nextCursor),
    )
  ).data;
  assert.deepEqual(
    [...first.items, ...second.items].map((x) => x.id),
    ['a', 'b', 'c'],
  );
  assert.equal((await q('/api/images/a/original')).status, 200);
  assert.equal((await q('/api/images/a/thumbnail')).status, 200);
  assert.equal((await q('/api/images/%2e%2e%2f/original')).status, 404);
});
test('copying masks updates all cameras atomically without copying other camera settings', async (t) => {
  const c = await apiContext(t),
    q = c.request;
  await q('/api/setup', { token: 'test-setup', password: 'long-enough-password' });
  c.repos.nvrs.save({ id: 'nvr' });
  const masks = [{ x: 0.7, y: 0, width: 0.3, height: 0.1 }];
  const source = {
    id: 'source',
    nvrId: 'nvr',
    channel: 1,
    name: 'Giriş',
    enabled: true,
    intervalMs: 600000,
    anchorMs: 3600000,
    sensitivity: 'high',
    masks: [],
    calibrated: true,
    policyVersion: 4,
  };
  const target = {
    ...source,
    id: 'target',
    channel: 2,
    name: 'Bahçe',
    enabled: false,
    intervalMs: 900000,
    sensitivity: 'low',
    policyVersion: 8,
  };
  const same = { ...source, id: 'same', channel: 3, masks, policyVersion: 3 };
  for (const camera of [source, target, same]) c.repos.cameras.save(camera);
  const endpoint = '/api/cameras/source/copy-masks';
  assert.equal((await q(endpoint, { masks }, 'POST', { 'X-CSRF-Token': 'bad' })).status, 403);
  assert.equal((await q(endpoint, { masks: [{ x: 0, y: 0, width: 1, height: 1 }] })).status, 400);
  assert.equal((await q(endpoint, { masks: [] })).status, 400);
  assert.equal((await q('/api/cameras/unknown/copy-masks', { masks })).status, 404);
  const original = c.repos.cameras.save;
  c.repos.cameras.save = (row) => {
    if (row.id === 'target') throw Error('simulated write failure');
    return original(row);
  };
  assert.equal((await q(endpoint, { masks })).status, 500);
  assert.deepEqual(c.repos.cameras.get('source'), source);
  c.repos.cameras.save = original;
  const result = await q(endpoint, { masks });
  assert.equal(result.status, 200);
  assert.deepEqual(result.data, { updated: 2, total: 3 });
  assert.deepEqual(c.repos.cameras.get('source'), {
    ...source,
    masks,
    calibrated: false,
    policyVersion: 5,
  });
  assert.deepEqual(c.repos.cameras.get('target'), {
    ...target,
    masks,
    calibrated: false,
    policyVersion: 9,
  });
  assert.deepEqual(c.repos.cameras.get('same'), same);
  assert.deepEqual((await q(endpoint, { masks })).data, { updated: 0, total: 3 });
  await q('/api/logout', {});
  assert.equal((await q(endpoint, { masks })).status, 401);
});
module.exports = { apiContext };
