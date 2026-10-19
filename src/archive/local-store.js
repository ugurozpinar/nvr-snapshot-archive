const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { error } = require('../errors');
async function syncDir(dir) {
  if (process.platform === 'win32') return;
  const handle = await fs.open(dir, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
function safePath(root, relative) {
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) throw error('INVALID_PATH');
  return resolved;
}
function createLocalStore({ repos, config }) {
  const active = new Set();
  async function localSpace() {
    await fs.mkdir(config.dataRoot, { recursive: true });
    const s = await fs.statfs(config.dataRoot);
    const a = await fs.statfs(config.archiveRoot).catch(() => s);
    return Math.min(Number(s.bavail) * Number(s.bsize), Number(a.bavail) * Number(a.bsize));
  }
  async function persist({ id = crypto.randomUUID(), cameraId, capturedAt, buffer }) {
    if (!/^[\w-]+$/.test(id) || !/^[\w-]+$/.test(cameraId)) throw error('INVALID_PATH');
    const exists = repos.images.get(id);
    if (exists) return exists;
    const settings = repos.settings.get('main') || {};
    const used = settings.nasPath ? repos.images.pendingStats().bytes : repos.images.stats().bytes;
    const quota = settings.nasPath ? settings.spoolQuotaBytes : settings.quotaBytes;
    if (!quota || used + buffer.length > quota)
      throw error(settings.nasPath ? 'SPOOL_FULL' : 'ARCHIVE_FULL');
    if ((await localSpace()) < config.localReserveBytes + buffer.length)
      throw error('LOCAL_SPACE_LOW');
    const date = new Date(capturedAt).toISOString();
    const relativePath = path.join(
      cameraId,
      date.slice(0, 4),
      date.slice(5, 7),
      date.slice(8, 10),
      `${date.replace(/[:.]/g, '-')}_${id}.jpg`,
    );
    const root = settings.nasPath ? config.spoolRoot : config.archiveRoot;
    const localPath = safePath(root, relativePath),
      temp = localPath + '.part';
    const image = {
      id,
      cameraId,
      capturedAt,
      bytes: buffer.length,
      checksum: crypto.createHash('sha256').update(buffer).digest('hex'),
      relativePath,
      localPath,
      nasPath: settings.nasPath ? relativePath : null,
      depotId: settings.depotId || null,
      state: settings.nasPath ? 'pending' : 'local',
      availability: 'available',
    };
    repos.jobs.save({ id: `persist:${id}`, kind: 'persist', image, temp });
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    const handle = await fs.open(temp, 'w', 0o600);
    try {
      await handle.writeFile(buffer);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(temp, localPath);
    await syncDir(path.dirname(localPath));
    repos.transaction(() => {
      repos.images.save(image);
      repos.jobs.remove(`persist:${id}`);
    });
    return image;
  }
  async function read(id) {
    const image = repos.images.get(id);
    if (!image) throw error('NOT_FOUND');
    if (!image.localPath) throw error('NAS_REQUIRED');
    // Only local paths created by this application enter this method.
    if (
      ![config.spoolRoot, config.archiveRoot].some((root) =>
        image.localPath.startsWith(path.resolve(root) + path.sep),
      )
    )
      throw error('INVALID_PATH');
    return fs.readFile(image.localPath);
  }
  async function reconcile() {
    for (const job of repos.jobs.list({ kind: 'persist', limit: 10000 })) {
      const image = job.image;
      let buffer = await fs.readFile(image.localPath).catch((e) => {
        if (e.code === 'ENOENT') return null;
        throw e;
      });
      if (!buffer)
        buffer = await fs.readFile(job.temp).catch((e) => {
          if (e.code === 'ENOENT') return null;
          throw e;
        });
      if (
        buffer &&
        buffer.length === image.bytes &&
        crypto.createHash('sha256').update(buffer).digest('hex') === image.checksum
      ) {
        if (!(await fs.stat(image.localPath).catch(() => null)))
          await fs.rename(job.temp, image.localPath);
        await syncDir(path.dirname(image.localPath));
        repos.transaction(() => {
          repos.images.save(image);
          repos.jobs.remove(job.id);
        });
      } else {
        await fs.rm(job.temp, { force: true });
        repos.jobs.remove(job.id);
      }
    }
    // Transferred state was committed before unlink. Finish cleanup after a crash.
    for (const image of repos.images.list({ state: 'transferred', limit: 10000 }))
      if (image.localPath) {
        await fs.rm(image.localPath, { force: true });
        repos.images.save({ ...image, localPath: null });
      }
  }
  async function withLease(id, fn) {
    if (active.has(id)) throw error('IMAGE_BUSY');
    active.add(id);
    try {
      return await fn();
    } finally {
      active.delete(id);
    }
  }
  return { persist, read, reconcile, localSpace, withLease, active };
}
module.exports = { createLocalStore, safePath, syncDir };
