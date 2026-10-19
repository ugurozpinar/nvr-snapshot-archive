const { deleteBatch } = require('./deletion');
const { compactCamera } = require('./compaction');
function canRecord({
  settings,
  localSpace,
  spoolBytes,
  archiveBytes = 0,
  reserveBytes = 256 * 1024 ** 2,
  imageBytes = 20 * 1024 ** 2,
}) {
  if (!settings?.quotaBytes) return { allowed: false, reason: 'QUOTA_REQUIRED' };
  if (
    settings.nasPath &&
    (!settings.spoolQuotaBytes || spoolBytes + imageBytes > settings.spoolQuotaBytes)
  )
    return { allowed: false, reason: 'SPOOL_FULL' };
  if (!settings.nasPath && archiveBytes + imageBytes > settings.quotaBytes)
    return { allowed: false, reason: 'ARCHIVE_FULL' };
  if (localSpace < reserveBytes + imageBytes) return { allowed: false, reason: 'LOCAL_SPACE_LOW' };
  return { allowed: true };
}
async function enforceCapacity(deps) {
  const { repos } = deps,
    quota = repos.settings.get('main')?.quotaBytes;
  if (!quota || repos.images.stats().bytes < quota * 0.95) return;
  for (const camera of repos.cameras.list({ limit: 10000 })) await compactCamera(camera.id, deps);
  const stats = repos.images.stats();
  let bytes = stats.bytes;
  if (bytes <= quota * 0.9) return;
  const victims = [];
  for (const image of repos.images.list({ limit: 1000 })) {
    if (image.state === 'pending' || image.availability === 'missing') continue;
    victims.push(image);
    bytes -= image.bytes;
    if (bytes <= quota * 0.9) break;
  }
  if (victims.length) await deleteBatch(victims, 'capacity', deps);
}
function storageStats({ repos, clock = { now: Date.now } }) {
  const stats = repos.images.stats(),
    pending = repos.images.pendingStats(),
    settings = repos.settings.get('main') || {};
  const recent = repos.db
    .prepare(
      "SELECT count(*) count, sum(json_extract(data,'$.bytes')) bytes FROM images WHERE json_extract(data,'$.capturedAt') >= ?",
    )
    .get(clock.now() - 7 * 86400000);
  const cameras = repos.cameras.list({ enabled: true, limit: 10000 });
  const dailyRate = cameras.reduce((n, c) => n + 86400000 / (c.intervalMs || 900000), 0);
  const dailyBytes = recent.count && dailyRate ? (recent.bytes / recent.count) * dailyRate : null;
  return {
    ...stats,
    pending,
    quotaBytes: settings.quotaBytes || null,
    spoolQuotaBytes: settings.spoolQuotaBytes || null,
    estimatedDays: dailyBytes ? settings.quotaBytes / dailyBytes : null,
    estimateKind: 'approximate-before-compaction',
    compactionEnabled: !!settings.compactionEnabled,
  };
}
module.exports = { enforceCapacity, storageStats, canRecord };
