const { randomUUID } = require('node:crypto');
function localDay(time) {
  return new Date(time + 3 * 3600000).toISOString().slice(0, 10);
}
function dayStart(day) {
  return Date.parse(day + 'T00:00:00+03:00');
}
function createHistory({ repos, clock = { now: Date.now } }) {
  const now = () => clock.now();
  function summary(cameraId, day) {
    return (
      repos.history.get(`daily:${cameraId}:${day}`) || {
        id: `daily:${cameraId}:${day}`,
        kind: 'daily',
        scope: cameraId,
        day,
        start: dayStart(day),
        end: dayStart(day) + 86400000,
        planned: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        reasons: {},
        deleted: {},
        deletedBytes: 0,
      }
    );
  }
  function updateDaily(cameraId, time, fn) {
    const row = summary(cameraId, localDay(time));
    fn(row);
    repos.history.save(row);
  }
  function openPeriod(scope, reason, extra = {}) {
    const existing = extra.end == null ? repos.history.openPeriods(scope, reason)[0] : null;
    if (existing) return existing.id;
    const row = {
      id: randomUUID(),
      kind: 'period',
      scope,
      reason,
      start: now(),
      end: null,
      ...extra,
    };
    repos.history.save(row);
    return row.id;
  }
  function closePeriod(id) {
    const p = repos.history.get(id);
    if (p && p.end == null) repos.history.save({ ...p, end: now() });
  }
  function closeScope(scope) {
    for (const p of repos.history.openPeriods(scope)) if (p.end == null) closePeriod(p.id);
  }
  function beginCapture(camera, dueAt) {
    const id = randomUUID();
    repos.transaction(() => {
      repos.jobs.save({ id, kind: 'capture', cameraId: camera.id, dueAt, start: now() });
      updateDaily(camera.id, dueAt, (r) => r.planned++);
    });
    return id;
  }
  function finishCapture(id, result) {
    const job = repos.jobs.get(id);
    if (!job) return;
    repos.transaction(() => {
      updateDaily(job.cameraId, job.dueAt, (r) => {
        r[
          result.status === 'success'
            ? 'success'
            : result.status === 'skipped'
              ? 'skipped'
              : 'failed'
        ]++;
        if (result.reason) r.reasons[result.reason] = (r.reasons[result.reason] || 0) + 1;
      });
      repos.jobs.remove(id);
      if (result.status === 'success') closeScope(job.cameraId);
      else openPeriod(job.cameraId, result.reason || 'UNKNOWN');
    });
  }
  function recordDeletionBatch(batch) {
    if (repos.history.get(`batch:${batch.id}`)) return;
    repos.transaction(() => {
      repos.history.save({
        id: `batch:${batch.id}`,
        kind: 'deletion',
        scope: batch.cameraId,
        start: batch.from,
        end: batch.to,
        reason: batch.reason,
        count: batch.count,
        bytes: batch.bytes,
        policyVersion: batch.policyVersion,
        precision: 'period',
      });
      updateDaily(batch.cameraId, batch.from, (r) => {
        r.deleted[batch.reason] = (r.deleted[batch.reason] || 0) + batch.count;
        r.deletedBytes += batch.bytes;
      });
    });
  }
  function heartbeat(clean = false) {
    repos.settings.save({ id: 'heartbeat', time: now(), clean });
  }
  function recordSkipped(camera, start, count, reason = 'SCHEDULE_SKIPPED', approximate = false) {
    if (count <= 0) return;
    repos.transaction(() => {
      let done = 0;
      while (done < count) {
        const at = start + done * camera.intervalMs,
          day = localDay(at),
          end = dayStart(day) + 86400000;
        const n = Math.min(count - done, Math.ceil((end - at) / camera.intervalMs));
        updateDaily(camera.id, at, (row) => {
          row.planned += n;
          row.skipped += n;
          row.reasons[reason] = (row.reasons[reason] || 0) + n;
          row.approximateCounts = !!row.approximateCounts || approximate;
        });
        done += n;
      }
      openPeriod(camera.id, reason, {
        start,
        end: start + (count - 1) * camera.intervalMs,
        approximate,
      });
    });
  }
  function recoverStartup() {
    const last = repos.settings.get('heartbeat');
    if (last && last.time < now())
      openPeriod('system', 'APP_OFFLINE', {
        start: last.time,
        end: now(),
        approximate: !last.clean,
      });
    for (const camera of repos.cameras.list({ enabled: true, limit: 10000 }))
      if (last && camera.nextDueAt) {
        const start = Math.max(camera.nextDueAt, last.time);
        const interval = camera.intervalMs || 900000;
        const first =
          camera.nextDueAt +
          Math.max(0, Math.ceil((start - camera.nextDueAt) / interval)) * interval;
        recordSkipped(
          { ...camera, intervalMs: interval },
          first,
          Math.max(0, Math.ceil((now() - first) / interval)),
          'APP_OFFLINE',
          !last.clean,
        );
      }
    recoverCaptures(true);
    heartbeat();
  }
  function recoverCaptures(all = false) {
    for (const job of repos.jobs.list({ kind: 'capture', limit: 10000 })) {
      if (!all && !job.recoveryNeeded) continue;
      if (repos.jobs.get(`persist:${job.id}`)) continue;
      const saved = repos.images.get(job.id);
      finishCapture(
        job.id,
        saved ? { status: 'success' } : { status: 'failed', reason: 'CAPTURE_INTERRUPTED' },
      );
      const camera = repos.cameras.get(job.cameraId);
      if (saved && camera)
        repos.cameras.save({ ...camera, lastSuccess: saved.capturedAt, lastError: null });
    }
  }
  function settingChanged(camera) {
    repos.history.save({
      id: randomUUID(),
      kind: 'setting',
      scope: camera.id,
      start: now(),
      end: now(),
      enabled: camera.enabled,
      intervalMs: camera.intervalMs,
      policyVersion: camera.policyVersion,
    });
    if (!camera.enabled) openPeriod(camera.id, 'ADMIN_DISABLED');
    else {
      for (const p of repos.history.list({
        kind: 'period',
        scope: camera.id,
        reason: 'ADMIN_DISABLED',
      }))
        closePeriod(p.id);
    }
  }
  return {
    beginCapture,
    finishCapture,
    openPeriod,
    closePeriod,
    closeScope,
    recordDeletionBatch,
    recordSkipped,
    heartbeat,
    recoverStartup,
    recoverCaptures,
    settingChanged,
    summarize: summary,
    query: (cameraId, from, to) => repos.history.between(cameraId, from, to),
  };
}
module.exports = { createHistory, localDay, dayStart };
