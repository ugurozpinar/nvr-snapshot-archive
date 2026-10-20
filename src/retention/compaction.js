const { compareImages } = require('./similarity');
const { readImage } = require('../nas/transfer');
const { deleteBatch } = require('./deletion');
async function compactCamera(cameraId, deps, options = {}) {
  const { repos, clock = { now: Date.now } } = deps,
    camera = repos.cameras.get(cameraId),
    settings = repos.settings.get('main');
  if (!camera || (!options.manual && !settings?.compactionEnabled)) return { deleted: 0 };
  const policyVersion = camera.policyVersion || 1,
    key = `compaction:${cameraId}:${policyVersion}`;
  if (options.manual && options.policyVersion !== policyVersion)
    return { deleted: 0, cancelled: true };
  const progress = options.manual ? options.progress || {} : repos.settings.get(key) || {};
  let reference = progress.referenceId ? repos.images.get(progress.referenceId) : null;
  const images = repos.images.list({
    cameraId,
    from: options.manual ? options.from : undefined,
    to: options.manual ? options.to : clock.now() - 168 * 3600000 + 1,
    after: progress.after,
    limit: 200,
  });
  const victims = [];
  const policy = {
    cameraId,
    version: policyVersion,
    manual: !!options.manual,
    compactionVersion: settings?.compactionVersion || 0,
  };
  const valid = () => {
    const c = repos.cameras.get(cameraId),
      s = repos.settings.get('main');
    return (
      !!c &&
      (c.policyVersion || 1) === policyVersion &&
      (options.manual ||
        (!!s?.compactionEnabled && (s.compactionVersion || 0) === policy.compactionVersion))
    );
  };
  let after = progress.after,
    skipped = 0;
  for (const image of images) {
    if (
      image.state === 'pending' ||
      image.availability === 'missing' ||
      image.availability === 'unavailable'
    ) {
      if (!options.manual) break;
      skipped++;
      reference = null;
      after = { time: image.capturedAt, id: image.id };
      continue;
    }
    if (
      !reference ||
      image.capturedAt - reference.capturedAt >=
        Math.max(camera.anchorMs || 3600000, camera.intervalMs || 900000)
    )
      reference = image;
    else {
      let comparison;
      try {
        comparison = await compareImages(
          await readImage(reference.id, deps),
          await readImage(image.id, deps),
          camera,
        );
      } catch (e) {
        if (options.manual) throw e;
        break;
      }
      if (comparison.similar) victims.push({ ...image, policyVersion });
      else reference = image;
    }
    after = { time: image.capturedAt, id: image.id };
  }
  if (!valid()) return { deleted: 0, cancelled: true };
  const result = victims.length
    ? await deleteBatch(victims, 'similarity', deps, null, policy)
    : { deleted: 0 };
  // Cursor advances only after all physical deletion and summaries committed.
  if (!options.manual && valid() && !result.cancelled)
    repos.settings.save({ id: key, referenceId: reference?.id, after });
  return {
    ...result,
    cancelled: !!result.cancelled || !valid(),
    skipped,
    progress: { after, referenceId: reference?.id },
    more: images.length === 200 && !!after && after !== progress.after,
  };
}
async function cleanupRecent(deps, days) {
  if (!Number.isSafeInteger(days) || days < 1 || days > 36600)
    throw Object.assign(Error('INVALID_CLEANUP_DAYS'), {
      code: 'INVALID_CLEANUP_DAYS',
      status: 400,
    });
  const to = (deps.clock?.now || Date.now)() + 1,
    from = to - 1 - days * 86400000;
  let deleted = 0,
    skipped = 0;
  const cameras = deps.repos.cameras.list({ limit: 10000 });
  for (const camera of cameras) {
    let progress;
    while (true) {
      const result = await compactCamera(camera.id, deps, {
        manual: true,
        from,
        to,
        progress,
        policyVersion: camera.policyVersion || 1,
      });
      deleted += result.deleted;
      skipped += result.skipped || 0;
      if (result.cancelled)
        throw Object.assign(Error('CLEANUP_POLICY_CHANGED'), {
          code: 'CLEANUP_POLICY_CHANGED',
          status: 409,
        });
      if (!result.more) break;
      progress = result.progress;
    }
  }
  return { deleted, skipped, cameras: cameras.length, from, to };
}
module.exports = { compactCamera, cleanupRecent };
