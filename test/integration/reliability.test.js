const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { context, jpeg } = require('../helpers/context');
const { createLocalStore } = require('../../src/archive/local-store');
const { createHistory } = require('../../src/history/service');

test('concurrent local writes cannot overrun the spool quota', async (t) => {
  const ctx = context(t),
    buffer = await jpeg(),
    store = createLocalStore(ctx);
  ctx.repos.settings.save({
    ...ctx.repos.settings.get('main'),
    nasPath: '/fixture',
    spoolQuotaBytes: Math.floor(buffer.length * 1.5),
  });
  const results = await Promise.allSettled(
    ['one', 'two'].map((id) =>
      store.persist({ id, cameraId: 'cam', capturedAt: Date.now(), buffer }),
    ),
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.ok(ctx.repos.images.pendingStats().bytes <= Math.floor(buffer.length * 1.5));
});

test('restart recognizes a persisted capture instead of reporting a false failure', async (t) => {
  const ctx = context(t),
    store = createLocalStore(ctx),
    history = createHistory(ctx),
    now = Date.now();
  const job = history.beginCapture({ id: 'cam' }, now);
  await store.persist({ id: job, cameraId: 'cam', capturedAt: now, buffer: await jpeg() });
  history.recoverStartup();
  const daily = history.summarize('cam', require('../../src/history/service').localDay(now));
  assert.equal(daily.success, 1);
  assert.equal(daily.failed, 0);
});

test('NAS permission errors invalidate a previously healthy status', async () => {
  const { createNasSupervisor } = require('../../src/nas/supervisor');
  const child = new EventEmitter();
  let fail = false;
  child.kill = () => true;
  child.send = (message) =>
    queueMicrotask(() =>
      child.emit('message', {
        id: message.id,
        ...(fail ? { error: 'EACCES' } : { result: { tour: 'first' } }),
      }),
    );
  const nas = createNasSupervisor({ spawn: () => child, retryMs: 0 });
  await nas.request('health', {});
  assert.equal(nas.status().available, true);
  fail = true;
  await assert.rejects(nas.request('health', {}), { code: 'EACCES' });
  assert.equal(nas.status().available, false);
  nas.stop();
});

test('camera edits cannot postpone an unchanged camera schedule', async (t) => {
  const { createScheduler } = require('../../src/capture/scheduler');
  const ctx = context(t);
  let now = 100000,
    captures = [];
  ctx.repos.nvrs.save({ id: 'n' });
  for (const id of ['cam1', 'cam2'])
    ctx.repos.cameras.save({
      id,
      nvrId: 'n',
      channel: id === 'cam1' ? 1 : 2,
      enabled: true,
      intervalMs: 900000,
    });
  const scheduler = createScheduler({
    ...ctx,
    clock: { now: () => now },
    history: createHistory({ ...ctx, clock: { now: () => now } }),
    store: { localSpace: async () => 1e12, persist: async () => {} },
    client: {
      captureSnapshot: async ({ channel }) => {
        captures.push(channel);
        return { buffer: Buffer.from('image') };
      },
    },
  });
  await scheduler.tick();
  await scheduler.drain();
  now += 60000;
  ctx.repos.cameras.save({ ...ctx.repos.cameras.get('cam1'), intervalMs: 1800000 });
  scheduler.refresh();
  now = 100000 + 900000;
  await scheduler.tick();
  await scheduler.drain();
  assert.equal(captures.filter((n) => n === 2).length, 2);
  await scheduler.stop();
});

test('missing NAS image records one loss event, not another on every check', async (t) => {
  const { verifyPresence } = require('../../src/nas/transfer');
  const ctx = context(t),
    history = createHistory(ctx);
  let tour = 0;
  ctx.repos.images.save({
    id: 'remote',
    state: 'transferred',
    cameraId: 'cam',
    capturedAt: 100,
    bytes: 20,
    nasPath: 'cam/a.jpg',
    availability: 'available',
  });
  const nas = {
    request: async (op) =>
      op === 'health' ? { tour: String(++tour) } : { exists: false, tour: String(tour) },
  };
  for (let i = 0; i < 4; i++) await verifyPresence('remote', { ...ctx, history, nas });
  assert.equal(
    history.query('cam', 0, Date.now()).filter((r) => r.reason === 'FILE_MISSING').length,
    1,
  );
});

test('delete recovery completes summaries once after catalog commit failure', async (t) => {
  const { deleteBatch, recoverDeletes } = require('../../src/retention/deletion');
  const ctx = context(t),
    store = createLocalStore(ctx),
    history = createHistory(ctx),
    now = Date.now();
  const image = await store.persist({
    id: 'delete-me',
    cameraId: 'cam',
    capturedAt: now,
    buffer: await jpeg(),
  });
  const remove = ctx.repos.images.remove;
  let fail = true;
  ctx.repos.images.remove = (id) => {
    if (fail) {
      fail = false;
      throw Error('interrupted');
    }
    remove(id);
  };
  await assert.rejects(deleteBatch([image], 'capacity', { ...ctx, store, history }));
  await recoverDeletes({ ...ctx, store, history });
  await recoverDeletes({ ...ctx, store, history });
  assert.equal(ctx.repos.images.get('delete-me'), null);
  assert.equal(
    history.summarize('cam', require('../../src/history/service').localDay(now)).deleted.capacity,
    1,
  );
});

test('changing comparison policy during analysis cancels old-policy deletion', async (t) => {
  const { compactCamera } = require('../../src/retention/compaction');
  const ctx = context(t),
    store = createLocalStore(ctx),
    history = createHistory(ctx),
    now = Date.now();
  ctx.repos.settings.save({ ...ctx.repos.settings.get('main'), compactionEnabled: true });
  ctx.repos.cameras.save({
    id: 'cam',
    intervalMs: 900000,
    anchorMs: 3600000,
    calibrated: true,
    policyVersion: 1,
    masks: [],
  });
  const buffer = await jpeg();
  for (let i = 0; i < 2; i++)
    await store.persist({
      id: `policy-${i}`,
      cameraId: 'cam',
      capturedAt: now - 8 * 86400000 + i * 900000,
      buffer,
    });
  const read = store.read;
  let count = 0;
  store.read = async (id) => {
    const b = await read(id);
    if (++count === 2)
      ctx.repos.cameras.save({
        ...ctx.repos.cameras.get('cam'),
        policyVersion: 2,
        calibrated: false,
      });
    return b;
  };
  await compactCamera('cam', { ...ctx, store, history, clock: { now: () => now } });
  assert.equal(ctx.repos.images.stats().count, 2);
  assert.equal(ctx.repos.settings.get('compaction:cam:1'), null);
});

test('delayed ticks account for missed opportunities on the correct local day', async (t) => {
  const { createScheduler } = require('../../src/capture/scheduler');
  const ctx = context(t);
  let now = Date.parse('2026-10-19T20:50:00Z');
  ctx.repos.nvrs.save({ id: 'n' });
  ctx.repos.cameras.save({ id: 'cam', nvrId: 'n', channel: 1, enabled: true, intervalMs: 900000 });
  const clock = { now: () => now },
    history = createHistory({ ...ctx, clock });
  const scheduler = createScheduler({
    ...ctx,
    clock,
    history,
    store: { localSpace: async () => 1e12, persist: async () => {} },
    client: { captureSnapshot: async () => ({ buffer: Buffer.from('jpg') }) },
  });
  await scheduler.tick();
  await scheduler.drain();
  now += 3600000;
  await scheduler.tick();
  await scheduler.drain();
  const day = history.summarize('cam', '2026-10-20');
  assert.equal(day.planned, 4);
  assert.equal(day.skipped, 3);
  assert.equal(day.success, 1);
  await scheduler.stop();
});

test('parallel archive readers are queued rather than failing with NAS_BUSY', async () => {
  const { createNasSupervisor } = require('../../src/nas/supervisor');
  const child = new EventEmitter();
  child.kill = () => true;
  child.send = (message) =>
    setTimeout(
      () => child.emit('message', { id: message.id, result: { number: message.payload.number } }),
      5,
    );
  const nas = createNasSupervisor({ spawn: () => child });
  const results = await Promise.all([
    nas.request('read', { number: 1 }),
    nas.request('read', { number: 2 }),
  ]);
  assert.deepEqual(
    results.map((r) => r.number),
    [1, 2],
  );
  nas.stop();
});

test('shared NAS low space pauses transfer while keeping the local original', async (t) => {
  const fs = require('node:fs/promises'),
    path = require('node:path'),
    crypto = require('node:crypto');
  const { createNasOperations } = require('../../src/nas/worker');
  const ctx = context(t);
  const root = path.join(ctx.dir, 'nas');
  await fs.mkdir(root);
  const settings = {
    nasPath: root,
    mountPoint: root,
    mountSource: '//fixture/share',
    depotId: 'd',
  };
  const ops = createNasOperations({
    mountProbe: async () => ({ mountPoint: root, source: '//fixture/share' }),
    spaceProbe: async () => ({ bavail: 0, bsize: 4096 }),
  });
  await ops('initialize', { settings });
  const buffer = await jpeg(),
    source = path.join(ctx.dir, 'local.jpg');
  await fs.writeFile(source, buffer);
  await assert.rejects(
    ops('transfer', {
      settings,
      source,
      relativePath: 'cam/a.jpg',
      bytes: buffer.length,
      checksum: crypto.createHash('sha256').update(buffer).digest('hex'),
    }),
    { code: 'NAS_SPACE_LOW' },
  );
  assert.equal((await fs.stat(source)).size, buffer.length);
});

test('a full spool is visible in camera status without making an NVR request', async (t) => {
  const { createScheduler } = require('../../src/capture/scheduler');
  const ctx = context(t);
  ctx.repos.nvrs.save({ id: 'n' });
  ctx.repos.cameras.save({ id: 'cam', nvrId: 'n', channel: 1, enabled: true, intervalMs: 900000 });
  ctx.repos.settings.save({
    ...ctx.repos.settings.get('main'),
    nasPath: '/fixture',
    spoolQuotaBytes: 100,
  });
  let calls = 0;
  const scheduler = createScheduler({
    ...ctx,
    history: createHistory(ctx),
    store: { localSpace: async () => 1e12 },
    client: {
      captureSnapshot: async () => {
        calls++;
      },
    },
  });
  await scheduler.tick();
  await scheduler.drain();
  assert.equal(calls, 0);
  assert.equal(ctx.repos.cameras.get('cam').lastError, 'SPOOL_FULL');
  await scheduler.stop();
});

test('NAS low space pauses writes without labeling readable archived files inaccessible', async () => {
  const { createNasSupervisor } = require('../../src/nas/supervisor');
  const child = new EventEmitter();
  let full = false;
  child.kill = () => true;
  child.send = (m) =>
    queueMicrotask(() =>
      child.emit('message', {
        id: m.id,
        ...(full ? { error: 'NAS_SPACE_LOW' } : { result: { tour: 'healthy' } }),
      }),
    );
  const nas = createNasSupervisor({ spawn: () => child });
  await nas.request('health', {});
  full = true;
  await assert.rejects(nas.request('transfer', {}), { code: 'NAS_SPACE_LOW' });
  assert.equal(nas.status().available, true);
  assert.equal(nas.status().lastError, 'NAS_SPACE_LOW');
  nas.stop();
});
