const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { context, jpeg } = require('../helpers/context');
test('clock mask excludes clock differences without modifying original and conservatively retains errors', async () => {
  const { compareImages } = require('../../src/retention/similarity');
  const a = await jpeg('#222', 100, 100);
  const patch = await sharp({ create: { width: 20, height: 10, channels: 3, background: '#fff' } })
    .png()
    .toBuffer();
  const b = await sharp(a)
    .composite([{ input: patch, left: 0, top: 0 }])
    .jpeg()
    .toBuffer();
  const copy = Buffer.from(a);
  assert.equal((await compareImages(a, b, { masks: [], sensitivity: 'high' })).similar, false);
  assert.equal(
    (
      await compareImages(a, b, {
        masks: [{ x: 0, y: 0, width: 0.3, height: 0.2 }],
        sensitivity: 'medium',
      })
    ).similar,
    true,
  );
  assert.ok(a.equals(copy));
  assert.equal((await compareImages(a, Buffer.from('bad'), { masks: [] })).similar, false);
  await assert.rejects(compareImages(a, b, { masks: [{ x: 0, y: 0, width: 1, height: 1 }] }), {
    code: 'INVALID_MASK',
  });
});
test('compaction protects 168 hours and hourly anchors and is idempotent', async (t) => {
  const { compactCamera } = require('../../src/retention/compaction');
  const { createLocalStore } = require('../../src/archive/local-store');
  const { createHistory } = require('../../src/history/service');
  const ctx = context(t),
    store = createLocalStore(ctx),
    now = Date.UTC(2026, 9, 19),
    history = createHistory(ctx);
  ctx.repos.settings.save({ ...ctx.repos.settings.get('main'), compactionEnabled: true });
  ctx.repos.cameras.save({
    id: 'cam',
    intervalMs: 900000,
    anchorMs: 3600000,
    policyVersion: 1,
    masks: [],
    calibrated: false,
  });
  const old = now - 8 * 86400000,
    buffer = await jpeg();
  for (let i = 0; i < 6; i++)
    await store.persist({ id: `old-${i}`, cameraId: 'cam', capturedAt: old + i * 900000, buffer });
  await store.persist({
    id: 'young',
    cameraId: 'cam',
    capturedAt: now - 168 * 3600000 + 1,
    buffer,
  });
  const deps = { ...ctx, store, history, clock: { now: () => now } };
  await compactCamera('cam', deps);
  await compactCamera('cam', deps);
  assert.deepEqual(
    ctx.repos.images.list().map((x) => x.id),
    ['old-0', 'old-4', 'young'],
  );
  assert.equal(history.summarize('cam', '2026-10-11').deleted.similarity, 4);
});

test('manual cleanup scans every page in the last X days, preserving anchors and automatic progress', async (t) => {
  const { cleanupRecent } = require('../../src/retention/compaction');
  const { createLocalStore } = require('../../src/archive/local-store');
  const { createHistory } = require('../../src/history/service');
  const ctx = context(t),
    store = createLocalStore(ctx),
    history = createHistory(ctx);
  const now = Date.UTC(2026, 9, 20),
    buffer = await jpeg();
  ctx.repos.settings.save({ ...ctx.repos.settings.get('main'), compactionEnabled: false });
  for (const id of ['cam', 'disabled']) {
    ctx.repos.cameras.save({
      id,
      enabled: id === 'cam',
      calibrated: false,
      policyVersion: 1,
      intervalMs: 1000,
      anchorMs: 3600000,
      masks: [],
    });
    await store.persist({
      id: `${id}-outside`,
      cameraId: id,
      capturedAt: now - 4 * 86400000,
      buffer,
    });
    for (let i = 0; i < 205; i++)
      await store.persist({
        id: `${id}-${i}`,
        cameraId: id,
        capturedAt: now - 86400000 + i * 1000,
        buffer,
      });
    await store.persist({
      id: `${id}-anchor`,
      cameraId: id,
      capturedAt: now - 86400000 + 3600000,
      buffer,
    });
  }
  const progress = { id: 'compaction:cam:1', after: { time: now, id: 'future' } };
  ctx.repos.settings.save(progress);
  const deps = { ...ctx, store, history, clock: { now: () => now } };
  assert.equal((await cleanupRecent(deps, 3)).deleted, 408);
  assert.deepEqual(ctx.repos.settings.get(progress.id), progress);
  assert.deepEqual(
    ctx.repos.images.list().map((i) => i.id),
    ['cam-outside', 'disabled-outside', 'cam-0', 'disabled-0', 'cam-anchor', 'disabled-anchor'],
  );
  assert.equal((await cleanupRecent(deps, 3)).deleted, 0);
  for (const days of [0, -1, 1.5, '3', 36601])
    await assert.rejects(cleanupRecent(deps, days), { code: 'INVALID_CLEANUP_DAYS' });
});

test('manual cleanup cancels when policy changes between pages', async (t) => {
  const { cleanupRecent } = require('../../src/retention/compaction');
  const { createHistory } = require('../../src/history/service');
  const ctx = context(t),
    buffer = await jpeg(),
    now = Date.now();
  const camera = { id: 'cam', policyVersion: 1, intervalMs: 1000, anchorMs: 3600000, masks: [] };
  ctx.repos.cameras.save(camera);
  for (let i = 0; i < 202; i++)
    ctx.repos.images.save({
      id: `image-${i}`,
      cameraId: 'cam',
      capturedAt: now - 3600000 + i * 1000,
      localPath: require('node:path').join(ctx.dir, 'absent.jpg'),
      state: 'local',
      bytes: buffer.length,
    });
  let deletions = 0;
  const store = {
    read: async () => buffer,
    withLease: async (id, fn) => {
      await fn();
      if (++deletions === 199) ctx.repos.cameras.save({ ...camera, policyVersion: 2 });
    },
  };
  await assert.rejects(cleanupRecent({ ...ctx, store, history: createHistory(ctx) }, 1), {
    code: 'CLEANUP_POLICY_CHANGED',
  });
  assert.equal(deletions, 199);
});
