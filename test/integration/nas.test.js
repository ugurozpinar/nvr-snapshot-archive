const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { context, jpeg } = require('../helpers/context');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
test('NAS path alone discovers the mount and creates or reuses depot identity', async (t) => {
  const { createNasOperations } = require('../../src/nas/worker');
  const ctx = context(t);
  const root = path.join(ctx.dir, 'mounted-share');
  await fs.mkdir(root);
  let mount = { mountPoint: root, source: '//fixture/share' };
  const ops = createNasOperations({ mountProbe: async () => mount });
  const discovered = await ops('configure', { settings: { nasPath: root } });
  assert.equal(discovered.mountPoint, root);
  assert.equal(discovered.mountSource, '//fixture/share');
  assert.ok(discovered.depotId);
  assert.equal(
    await fs.readFile(path.join(root, '.camera-archive-id'), 'utf8'),
    discovered.depotId,
  );
  assert.deepEqual(await ops('configure', { settings: { nasPath: root } }), discovered);
  const settings = { nasPath: root, ...discovered };
  await ops('health', { settings });
  mount = { mountPoint: path.parse(root).root, source: '/dev/local' };
  await assert.rejects(ops('configure', { settings: { nasPath: root } }), {
    code: 'NAS_WRONG_MOUNT',
  });
  await assert.rejects(ops('health', { settings }), { code: 'NAS_WRONG_MOUNT' });
});

test('automatic NAS setup preserves existing identity and rejects malformed markers', async (t) => {
  const { createNasOperations } = require('../../src/nas/worker');
  const ctx = context(t);
  const root = path.join(ctx.dir, 'mounted-share');
  await fs.mkdir(root);
  const marker = path.join(root, '.camera-archive-id');
  const ops = createNasOperations({
    mountProbe: async () => ({ mountPoint: root, source: '//fixture/share' }),
  });
  await fs.writeFile(marker, 'existing-depot');
  assert.equal((await ops('configure', { settings: { nasPath: root } })).depotId, 'existing-depot');
  await fs.writeFile(marker, '');
  await assert.rejects(ops('configure', { settings: { nasPath: root } }), {
    code: 'NAS_WRONG_DEPOT',
  });
  assert.equal(await fs.readFile(marker, 'utf8'), '');
});

test('automatic setup completes legacy configuration without trusting a different mount', async (t) => {
  const { createNasOperations } = require('../../src/nas/worker');
  const ctx = context(t);
  const root = path.join(ctx.dir, 'legacy-share');
  await fs.mkdir(root);
  const settings = {
    nasPath: root,
    mountPoint: root,
    mountSource: '//fixture/share',
    depotId: 'legacy-depot',
  };
  let source = '//wrong/share';
  const ops = createNasOperations({ mountProbe: async () => ({ mountPoint: root, source }) });
  await assert.rejects(ops('configure', { settings }), { code: 'NAS_WRONG_MOUNT' });
  await assert.rejects(fs.stat(path.join(root, '.camera-archive-id')), { code: 'ENOENT' });
  source = '//fixture/share';
  assert.equal((await ops('configure', { settings })).depotId, 'legacy-depot');
  await ops('health', { settings });
});

test('stuck NAS worker times out without spawning replacements while still alive', async () => {
  const { createNasSupervisor } = require('../../src/nas/supervisor');
  let spawned = 0;
  const child = new EventEmitter();
  child.connected = true;
  child.send = () => {};
  child.kill = () => true;
  const nas = createNasSupervisor({
    spawn: () => {
      spawned++;
      return child;
    },
    timeoutMs: 30,
    retryMs: 0,
    config: {},
  });
  await assert.rejects(nas.request('health', {}), { code: 'NAS_UNAVAILABLE' });
  await assert.rejects(nas.request('health', {}), { code: 'NAS_UNAVAILABLE' });
  assert.equal(spawned, 1);
  assert.equal(nas.status().stuck, true);
  child.emit('exit', null, 'SIGTERM');
  nas.stop();
});
test('NAS operations verify identity, transfer idempotently and never follow escaping symlinks', async (t) => {
  const { createNasOperations } = require('../../src/nas/worker');
  const ctx = context(t);
  const root = path.join(ctx.dir, 'fake-nas');
  await fs.mkdir(root);
  const settings = {
    nasPath: root,
    mountPoint: root,
    mountSource: '//fixture/share',
    depotId: 'fixture-depot',
  };
  const ops = createNasOperations({
    mountProbe: async () => ({ mountPoint: root, source: '//fixture/share' }),
  });
  await assert.rejects(ops('health', { settings }));
  await ops('initialize', { settings });
  const buffer = await jpeg(),
    source = path.join(ctx.dir, 'source.jpg');
  await fs.writeFile(source, buffer);
  const payload = {
    settings,
    source,
    relativePath: 'cam/2026/10/19/a.jpg',
    checksum: crypto.createHash('sha256').update(buffer).digest('hex'),
    bytes: buffer.length,
  };
  await ops('transfer', payload);
  await ops('transfer', payload);
  assert.ok((await fs.readFile(path.join(root, payload.relativePath))).equals(buffer));
  await assert.rejects(ops('health', { settings: { ...settings, mountSource: '//wrong/share' } }));
  await assert.rejects(ops('read', { settings, relativePath: '../source.jpg' }));
});
test('unavailability never marks missing and two verified absence tours do', async (t) => {
  const { verifyPresence, runTransfers } = require('../../src/nas/transfer');
  const { createLocalStore } = require('../../src/archive/local-store');
  const { createHistory } = require('../../src/history/service');
  const ctx = context(t);
  const store = createLocalStore(ctx),
    history = createHistory(ctx);
  ctx.repos.images.save({
    id: 'remote',
    state: 'transferred',
    cameraId: 'cam',
    capturedAt: 1,
    bytes: 500,
    nasPath: 'cam/a.jpg',
    availability: 'available',
  });
  const offline = {
    request: async () => {
      throw Object.assign(Error(), { code: 'NAS_UNAVAILABLE' });
    },
  };
  await verifyPresence('remote', { ...ctx, nas: offline, history });
  assert.equal(ctx.repos.images.get('remote').availability, 'unavailable');
  assert.equal(ctx.repos.images.stats().bytes, 500);
  let tour = 0;
  const nas = {
    request: async (op) =>
      op === 'health' ? { tour: String(++tour) } : { exists: false, tour: String(tour) },
  };
  await verifyPresence('remote', { ...ctx, nas, history });
  assert.notEqual(ctx.repos.images.get('remote').availability, 'missing');
  await verifyPresence('remote', { ...ctx, nas, history });
  assert.equal(ctx.repos.images.get('remote').availability, 'missing');
  assert.equal(ctx.repos.images.stats().bytes, 0);
  assert.equal(ctx.repos.images.get('remote').bytes, 500);
  ctx.repos.settings.save({ ...ctx.repos.settings.get('main'), nasPath: '/fixture', depotId: 'd' });
  const pending = await store.persist({
    id: 'p',
    cameraId: 'cam',
    capturedAt: Date.now(),
    buffer: await jpeg(),
  });
  await runTransfers({ ...ctx, nas: offline, history, store });
  assert.ok(await fs.stat(pending.localPath));
  assert.equal(ctx.repos.images.get('p').state, 'pending');
});
