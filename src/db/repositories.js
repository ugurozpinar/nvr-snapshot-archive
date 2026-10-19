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
  repos.images.stats = () =>
    db
      .prepare(
        "SELECT count(*) count, coalesce(sum(json_extract(data,'$.bytes')),0) bytes, min(json_extract(data,'$.capturedAt')) oldest, max(json_extract(data,'$.capturedAt')) newest FROM images",
      )
      .get();
  repos.images.pendingStats = () =>
    db
      .prepare(
        "SELECT count(*) count, coalesce(sum(json_extract(data,'$.bytes')),0) bytes FROM images WHERE json_extract(data,'$.state')='pending'",
      )
      .get();
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
