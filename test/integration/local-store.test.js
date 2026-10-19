const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { context, jpeg } = require('../helpers/context');
test('local durable intent recovers rename/catalog interruption exactly once', async (t) => {
  const { createLocalStore } = require('../../src/archive/local-store');
  const ctx = context(t);
  const store = createLocalStore(ctx);
  const data = {
    id: 'fixture-image',
    cameraId: 'camera-1',
    capturedAt: Date.UTC(2026, 9, 19),
    buffer: await jpeg(),
  };
  const original = ctx.repos.images.save;
  let fail = true;
  ctx.repos.images.save = (row) => {
    if (fail) {
      fail = false;
      throw Error('catalog failed');
    }
    return original(row);
  };
  await assert.rejects(store.persist(data));
  ctx.repos.images.save = original;
  await store.reconcile();
  await store.reconcile();
  const image = ctx.repos.images.get(data.id);
  assert.equal(image.state, 'local');
  assert.ok((await store.read(data.id)).equals(data.buffer));
  assert.equal(ctx.repos.images.list().length, 1);
  assert.equal(ctx.repos.jobs.list({ kind: 'persist' }).length, 0);
  assert.match(image.relativePath, /camera-1[\\/]2026[\\/]10[\\/]19/);
});
test('NAS capture writes only to local spool and preserves pending state', async (t) => {
  const { createLocalStore } = require('../../src/archive/local-store');
  const ctx = context(t);
  ctx.repos.settings.save({ ...ctx.repos.settings.get('main'), nasPath: '/unreachable-nas' });
  const image = await createLocalStore(ctx).persist({
    id: 'pending-1',
    cameraId: 'camera-1',
    capturedAt: Date.now(),
    buffer: await jpeg(),
  });
  assert.equal(image.state, 'pending');
  assert.ok(image.localPath.startsWith(ctx.config.spoolRoot));
  assert.equal((await fs.stat(image.localPath)).size, image.bytes);
});
