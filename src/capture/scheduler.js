const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { decryptSecret } = require('../security/secrets');
function createScheduler({
  repos,
  config = {},
  client,
  store,
  history,
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
  async function record(camera) {
    const job = history.beginCapture(camera, now());
    try {
      const settings = repos.settings.get('main') || {};
      const used = settings.nasPath
        ? repos.images.pendingStats().bytes
        : repos.images.stats().bytes;
      const quota = settings.nasPath ? settings.spoolQuotaBytes : settings.quotaBytes;
      if (
        !quota ||
        used + (config.maxImageBytes || 20 * 1024 ** 2) > quota ||
        (await store.localSpace()) <
          (config.localReserveBytes || 256 * 1024 ** 2) + (config.maxImageBytes || 20 * 1024 ** 2)
      ) {
        history.finishCapture(job, {
          status: 'skipped',
          reason: !quota ? 'QUOTA_REQUIRED' : settings.nasPath ? 'SPOOL_FULL' : 'LOCAL_SPACE_LOW',
        });
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
        id: randomUUID(),
        cameraId: camera.id,
        capturedAt,
        buffer: result.buffer,
      });
      history.finishCapture(job, { status: 'success' });
      const current = repos.cameras.get(camera.id);
      if (current) repos.cameras.save({ ...current, lastSuccess: capturedAt, lastError: null });
    } catch (e) {
      const code = e.code || 'LOCAL_WRITE_FAILED';
      try {
        history.finishCapture(job, { status: 'failed', reason: code });
        const current = repos.cameras.get(camera.id);
        if (current) repos.cameras.save({ ...current, lastError: code, lastFailure: now() });
      } catch {
        health = 'DATABASE_UNHEALTHY';
      }
    }
  }
  function pump() {
    while (!stopping && running.size < 4 && queue.length) {
      const camera = queue.shift();
      const p = record(camera)
        .catch(() => {
          health = 'DATABASE_UNHEALTHY';
        })
        .finally(() => {
          running.delete(p);
          busy.delete(camera.id);
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
        if (scheduled > now() || busy.has(camera.id)) continue;
        if (now() - scheduled >= camera.intervalMs)
          history.openPeriod(camera.id, 'SCHEDULE_SKIPPED', {
            start: scheduled,
            end: now(),
            approximate: true,
          });
        due.set(camera.id, now() + (camera.intervalMs || 900000));
        busy.add(camera.id);
        queue.push(camera);
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
      for (const camera of repos.cameras.list({ limit: 10000 }))
        due.set(camera.id, now() + (camera.intervalMs || 900000));
    },
    async stop({ deadlineMs = 5000 } = {}) {
      stopping = true;
      clearInterval(timer);
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
