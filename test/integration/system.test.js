const { test } = require('node:test');
const assert = require('node:assert/strict');
const { context, jpeg } = require('../helpers/context');
test('application composes capture, durable local archive and restart recovery', async (t) => {
  const { createApp } = require('../../src/app');
  const ctx = context(t),
    buffer = await jpeg();
  ctx.config.port = 0;
  ctx.repos.nvrs.save({ id: 'n' });
  for (let i = 0; i < 90; i++)
    ctx.repos.cameras.save({
      id: `c${i}`,
      nvrId: 'n',
      channel: i + 1,
      name: 'Kamera ' + i,
      enabled: true,
      intervalMs: 900000,
    });
  const client = { captureSnapshot: async () => ({ buffer }) };
  const app = await createApp(ctx.config, { client, log: () => {} });
  await app.start();
  await app.scheduler.drain();
  assert.equal(app.repos.images.stats().count, 90);
  const response = await fetch(`http://127.0.0.1:${app.address().port}/api/session`);
  assert.equal(response.status, 200);
  await app.stop();
  const second = await createApp(ctx.config, { client, log: () => {} });
  assert.equal(second.repos.images.stats().count, 90);
  await second.stop();
});
