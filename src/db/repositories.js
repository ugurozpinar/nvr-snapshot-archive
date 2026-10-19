const allowed = new Set([
  'id',
  'cameraId',
  'capturedAt',
  'state',
  'kind',
  'scope',
  'day',
  'reason',
  'enabled',
  'nvrId',
  'policyVersion',
]);
function createRepositories(db) {
  const repos = { db, transaction: (fn) => db.transaction(fn)() };
  for (const table of ['settings', 'nvrs', 'cameras', 'images', 'jobs', 'history']) {
    const get = db.prepare(`SELECT data FROM ${table} WHERE id=?`);
    const save = db.prepare(
      `INSERT INTO ${table}(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`,
    );
    repos[table] = {
      get(id) {
        const row = get.get(id);
        return row ? JSON.parse(row.data) : null;
      },
      save(record) {
        if (!record.id) throw Error('Record id required');
        save.run(record.id, JSON.stringify(record));
        return record;
      },
      remove(id) {
        db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
      },
      list(filter = {}) {
        const where = [],
          args = [];
        for (const [key, value] of Object.entries(filter)) {
          if (!allowed.has(key)) continue;
          where.push(`json_extract(data,'$.${key}') = ?`);
          args.push(typeof value === 'boolean' ? Number(value) : value);
        }
        if (filter.from != null) {
          where.push("json_extract(data,'$.capturedAt') >= ?");
          args.push(filter.from);
        }
        if (filter.to != null) {
          where.push("json_extract(data,'$.capturedAt') < ?");
          args.push(filter.to);
        }
        if (filter.after) {
          where.push(
            "(json_extract(data,'$.capturedAt') > ? OR (json_extract(data,'$.capturedAt') = ? AND id > ?))",
          );
          args.push(filter.after.time, filter.after.time, filter.after.id);
        }
        const order = table === 'images' ? "json_extract(data,'$.capturedAt'),id" : 'id';
        const limit = Math.min(Math.max(Number(filter.limit) || 1000, 1), 10000);
        return db
          .prepare(
            `SELECT data FROM ${table}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY ${order} LIMIT ?`,
          )
          .all(...args, limit)
          .map((r) => JSON.parse(r.data));
      },
    };
  }
  const recentImages = db.prepare(
    "SELECT data FROM images WHERE json_extract(data,'$.cameraId')=? ORDER BY json_extract(data,'$.capturedAt') DESC,id DESC LIMIT ?",
  );
  repos.images.recent = (cameraId, limit = 20) =>
    recentImages.all(cameraId, limit).map((row) => JSON.parse(row.data));
  repos.images.stats = () =>
    db
      .prepare(
        "SELECT count(*) count, coalesce(sum(CASE WHEN json_extract(data,'$.availability')='missing' THEN 0 ELSE json_extract(data,'$.bytes') END),0) bytes, coalesce(sum(json_extract(data,'$.bytes')),0) knownBytes, min(CASE WHEN json_extract(data,'$.availability')!='missing' THEN json_extract(data,'$.capturedAt') END) oldest, max(CASE WHEN json_extract(data,'$.availability')!='missing' THEN json_extract(data,'$.capturedAt') END) newest FROM images",
      )
      .get();
  repos.images.pendingStats = () =>
    db
      .prepare(
        "SELECT count(*) count, coalesce(sum(json_extract(data,'$.bytes')),0) bytes FROM images WHERE json_extract(data,'$.state')='pending'",
      )
      .get();
  repos.images.spoolBytes = () =>
    repos.db
      .prepare(
        "SELECT coalesce(sum(json_extract(data,'$.bytes')),0) bytes FROM images WHERE json_extract(data,'$.state')='pending' OR (json_extract(data,'$.state')='transferred' AND json_extract(data,'$.localPath') IS NOT NULL)",
      )
      .get().bytes;
  repos.jobs.reservedBytes = (pendingOnly = false) =>
    repos.db
      .prepare(
        "SELECT coalesce(sum(json_extract(j.data,'$.image.bytes')),0) bytes FROM jobs j WHERE json_extract(j.data,'$.kind')='persist' AND NOT EXISTS (SELECT 1 FROM images i WHERE i.id=json_extract(j.data,'$.image.id'))" +
          (pendingOnly ? " AND json_extract(j.data,'$.image.state')='pending'" : ''),
      )
      .get().bytes;
  repos.history.openPeriods = (scope, reason = null) =>
    repos.db
      .prepare(
        "SELECT data FROM history WHERE json_extract(data,'$.kind')='period' AND json_extract(data,'$.scope')=? AND json_extract(data,'$.end') IS NULL" +
          (reason ? " AND json_extract(data,'$.reason')=?" : ''),
      )
      .all(...(reason ? [scope, reason] : [scope]))
      .map((r) => JSON.parse(r.data));
  repos.history.between = (scope, from, to) =>
    db
      .prepare(
        "SELECT data FROM history WHERE (json_extract(data,'$.scope')=? OR json_extract(data,'$.scope')='system' OR json_extract(data,'$.scope')='nas') AND json_extract(data,'$.start') < ? AND coalesce(json_extract(data,'$.end'),9223372036854775807) >= ? ORDER BY json_extract(data,'$.start') LIMIT 1000",
      )
      .all(scope, to, from)
      .map((r) => JSON.parse(r.data));
  return repos;
}
module.exports = { createRepositories };
