const { test } = require('node:test');
const assert = require('node:assert/strict');
const { context } = require('../helpers/context');
test('90 cameras run with four global slots, permanent failures isolated and no overlaps', async (t) => {
  const { createScheduler } = require('../../src/capture/scheduler');
  const { createHistory } = require('../../src/history/service');
  const ctx = context(t);
  for (let i = 0; i < 90; i++)
    ctx.repos.cameras.save({
      id: `c${i}`,
      nvrId: 'n',
      channel: i + 1,
      enabled: true,
      intervalMs: 900000,
    });
  ctx.repos.nvrs.save({ id: 'n' });
  let active = 0,
    max = 0,
    success = 0;
  const seen = new Set();
  const client = {
    captureSnapshot: async ({ channel }) => {
      assert.ok(!seen.has(channel));
      seen.add(channel);
      active++;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 1));
      active--;
      if (channel === 1) throw Object.assign(Error(), { code: 'AUTH_FAILED' });
      return { buffer: Buffer.from('jpg') };
    },
  };
  const history = createHistory(ctx);
  const store = {
    persist: async () => {
      success++;
    },
    localSpace: async () => 1e12,
  };
  const s = createScheduler({ ...ctx, client, store, history });
  await s.tick();
  await s.drain();
  assert.equal(max, 4);
  assert.equal(success, 89);
  assert.equal(seen.size, 90);
  await s.tick();
  await s.drain();
  assert.equal(success, 89);
  await s.stop({ deadlineMs: 100 });
});
test('retry delays are bounded and no obsolete missed periods are queued', async (t) => {
  const { createScheduler } = require('../../src/capture/scheduler');
  const { createHistory } = require('../../src/history/service');
  const ctx = context(t);
  ctx.repos.nvrs.save({ id: 'n' });
  ctx.repos.cameras.save({ id: 'cam', nvrId: 'n', channel: 1, enabled: true, intervalMs: 900000 });
  let now = 1e8,
    calls = 0;
  const delays = [];
  const clock = {
    now: () => now,
    sleep: async (ms) => {
      delays.push(ms);
      now += ms;
    },
  };
  const s = createScheduler({
    ...ctx,
    clock,
    history: createHistory({ ...ctx, clock }),
    store: { persist: async () => {}, localSpace: async () => 1e12 },
    client: {
      captureSnapshot: async () => {
        calls++;
        if (calls < 3) throw Object.assign(Error(), { code: 'NVR_UNREACHABLE' });
        return { buffer: Buffer.from('x') };
      },
    },
  });
  await s.tick();
  await s.drain();
  assert.equal(calls, 3);
  assert.deepEqual(delays, [15000, 30000]);
  now += 86400000;
  await s.tick();
  await s.drain();
  assert.equal(calls, 4);
  await s.stop({ deadlineMs: 100 });
});
