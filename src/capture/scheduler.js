const { setTimeout: delay } = require('node:timers/promises');
const { decryptSecret } = require('../security/secrets');
const { canRecord } = require('../retention/capacity');
function createScheduler({
  repos,
  config = {},
  client,
  store,
  history,
  log = () => {},
  clock = { now: Date.now, sleep: (ms, signal) => delay(ms, null, { signal }) },
}) {
  const due = new Map(),
    busy = new Set(),
    running = new Set();
  let queue = [],
    timer,
    stopping = false,
    ticking = false,
    health = null;
  const now = () => clock.now();
  const abort = new AbortController();
  const signatures = new Map(
    repos.cameras.list({ limit: 10000 }).map((c) => [c.id, `${c.enabled}:${c.intervalMs}`]),
  );
  async function record({ camera, job }) {
    try {
      const settings = repos.settings.get('main') || {};
      const used = settings.nasPath ? repos.images.spoolBytes() : repos.images.stats().bytes;
      const admission = canRecord({
        settings,
        spoolBytes: used,
        archiveBytes: used,
        localSpace: await store.localSpace(),
        reserveBytes: config.localReserveBytes || 256 * 1024 ** 2,
        imageBytes: config.maxImageBytes || 20 * 1024 ** 2,
      });
      if (!admission.allowed) {
        history.finishCapture(job, {
          status: 'skipped',
          reason: admission.reason,
        });
        const current = repos.cameras.get(camera.id);
        if (current)
          repos.cameras.save({ ...current, lastError: admission.reason, lastFailure: now() });
        log('capture_skipped', { cameraId: camera.id, jobId: job, code: admission.reason });
        return;
      }
      const cameraNow = repos.cameras.get(camera.id);
      if (!cameraNow?.enabled) {
        history.finishCapture(job, { status: 'skipped', reason: 'ADMIN_DISABLED' });
        return;
      }
      const nvr = repos.nvrs.get(camera.nvrId);
      if (!nvr) throw Object.assign(Error(), { code: 'NVR_CONFIG_INVALID' });
      const credentials = {
        ...nvr,
        password: nvr.secret ? decryptSecret(nvr.secret, config.key) : nvr.password,
      };
      let result;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          result = await client.captureSnapshot({
            nvr: credentials,
            channel: camera.channel,
            signal: abort.signal,
          });
          break;
        } catch (e) {
          if (
            stopping ||
            attempt === 2 ||
            ['AUTH_FAILED', 'INVALID_IMAGE', 'NVR_CONFIG_INVALID'].includes(e.code)
          )
            throw e;
          if (clock.sleep) await clock.sleep([15000, 30000][attempt], abort.signal);
          else await delay([15000, 30000][attempt], null, { signal: abort.signal });
        }
      }
      const capturedAt = now();
      await store.persist({
        id: job,
        cameraId: camera.id,
        capturedAt,
        buffer: result.buffer,
      });
      history.finishCapture(job, { status: 'success' });
      log('snapshot_saved', { cameraId: camera.id, jobId: job });
      const current = repos.cameras.get(camera.id);
      if (current) repos.cameras.save({ ...current, lastSuccess: capturedAt, lastError: null });
    } catch (e) {
      const code = e.code || 'LOCAL_WRITE_FAILED';
      try {
        const saved = repos.images.get(job);
        if (saved) {
          history.finishCapture(job, { status: 'success' });
          const c = repos.cameras.get(camera.id);
          if (c) repos.cameras.save({ ...c, lastSuccess: saved.capturedAt, lastError: null });
          return;
        }
        log('capture_failed', { cameraId: camera.id, jobId: job, code });
        if (!repos.jobs.get(`persist:${job}`))
          history.finishCapture(job, { status: 'failed', reason: code });
        else {
          health = 'PERSISTENCE_RECOVERY_REQUIRED';
          const intent = repos.jobs.get(job);
          if (intent) repos.jobs.save({ ...intent, recoveryNeeded: true });
        }
        const current = repos.cameras.get(camera.id);
        if (current) repos.cameras.save({ ...current, lastError: code, lastFailure: now() });
      } catch {
        health = 'DATABASE_UNHEALTHY';
      }
    }
  }
  function pump() {
    while (!stopping && running.size < 4 && queue.length) {
      const item = queue.shift();
      const p = record(item)
        .catch(() => {
          health = 'DATABASE_UNHEALTHY';
        })
        .finally(() => {
          running.delete(p);
          busy.delete(item.camera.id);
          pump();
        });
      running.add(p);
    }
  }
  async function tick() {
    if (ticking || stopping) return;
    ticking = true;
    try {
      for (const camera of repos.cameras.list({ enabled: true, limit: 10000 })) {
        const scheduled = due.get(camera.id) ?? now();
        if (scheduled > now()) continue;
        const interval = camera.intervalMs || 900000;
        const missed = Math.floor((now() - scheduled) / interval) + (busy.has(camera.id) ? 1 : 0);
        if (missed) history.recordSkipped({ ...camera, intervalMs: interval }, scheduled, missed);
        const actualDue = scheduled + missed * interval;
        const next = busy.has(camera.id) ? actualDue : actualDue + interval;
        due.set(camera.id, next);
        repos.cameras.save({ ...camera, nextDueAt: next });
        signatures.set(camera.id, `${camera.enabled}:${camera.intervalMs}`);
        if (busy.has(camera.id)) continue;
        busy.add(camera.id);
        const job = history.beginCapture(camera, actualDue);
        queue.push({ camera, job });
      }
      pump();
    } catch {
      health = 'DATABASE_UNHEALTHY';
    } finally {
      ticking = false;
    }
  }
  async function drain() {
    while (running.size || queue.length) {
      pump();
      await Promise.all([...running]);
    }
  }
  return {
    tick,
    drain,
    status: () => ({ health, running: running.size, queued: queue.length }),
    start() {
      stopping = false;
      tick();
      timer = setInterval(() => tick(), 1000);
    },
    refresh() {
      const ids = new Set();
      for (const camera of repos.cameras.list({ limit: 10000 })) {
        ids.add(camera.id);
        const signature = `${camera.enabled}:${camera.intervalMs}`;
        if (signatures.get(camera.id) !== signature) {
          const next = signatures.has(camera.id) ? now() + (camera.intervalMs || 900000) : now();
          due.set(camera.id, next);
          repos.cameras.save({ ...camera, nextDueAt: next });
        }
        signatures.set(camera.id, signature);
      }
      for (const id of signatures.keys())
        if (!ids.has(id)) {
          signatures.delete(id);
          due.delete(id);
        }
    },
    async stop({ deadlineMs = 5000 } = {}) {
      stopping = true;
      clearInterval(timer);
      for (const item of queue)
        history.finishCapture(item.job, { status: 'skipped', reason: 'APPLICATION_SHUTDOWN' });
      queue = [];
      abort.abort();
      let id;
      await Promise.race([
        Promise.all([...running]),
        new Promise((r) => {
          id = setTimeout(r, deadlineMs);
        }),
      ]);
      clearTimeout(id);
    },
  };
}
module.exports = { createScheduler };
