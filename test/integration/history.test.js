const { test } = require('node:test');
const assert = require('node:assert/strict');
const { context } = require('../helpers/context');
test('daily history is durable idempotent and distinguishes outage from capture loss', (t) => {
  const { createHistory } = require('../../src/history/service');
  const ctx = context(t);
  let now = Date.UTC(2026, 9, 19, 21, 30);
  const h = createHistory({ ...ctx, clock: { now: () => now } });
  const camera = { id: 'cam', intervalMs: 900000 };
  const job = h.beginCapture(camera, now);
  h.finishCapture(job, { status: 'failed', reason: 'AUTH_FAILED' });
  h.finishCapture(job, { status: 'failed', reason: 'AUTH_FAILED' });
  const ok = h.beginCapture(camera, now + 900000);
  h.finishCapture(ok, { status: 'success' });
  const daily = h.summarize('cam', '2026-10-20');
  assert.equal(daily.planned, 2);
  assert.equal(daily.success, 1);
  assert.equal(daily.failed, 1);
  h.recordDeletionBatch({
    id: 'batch',
    cameraId: 'cam',
    reason: 'similarity',
    from: now,
    to: now + 100,
    count: 3,
    bytes: 99,
    policyVersion: 1,
  });
  h.recordDeletionBatch({
    id: 'batch',
    cameraId: 'cam',
    reason: 'similarity',
    from: now,
    to: now + 100,
    count: 3,
    bytes: 99,
    policyVersion: 1,
  });
  assert.equal(h.summarize('cam', '2026-10-20').deleted.similarity, 3);
  h.heartbeat();
  now += 600000;
  h.recoverStartup();
  assert.ok(
    h.query('cam', now - 1000000, now + 1).some((x) => x.reason === 'APP_OFFLINE' && x.approximate),
  );
  const id = h.openPeriod('nas', 'NAS_UNAVAILABLE');
  h.closePeriod(id);
  assert.equal(h.summarize('cam', '2026-10-20').failed, 1);
});
