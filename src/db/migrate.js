const fs = require('node:fs');
const path = require('node:path');
function migrate(db, directory = path.join(__dirname, 'migrations')) {
  const migrations = fs
    .readdirSync(directory)
    .filter((name) => /^\d+-.*\.sql$/.test(name))
    .map((name) => ({ name, version: Number.parseInt(name, 10) }))
    .sort((a, b) => a.version - b.version);
  const versions = new Set();
  for (const { version } of migrations) {
    if (!Number.isSafeInteger(version) || version < 1 || versions.has(version))
      throw Object.assign(new Error('Invalid or duplicate migration version'), {
        code: 'INVALID_MIGRATION',
      });
    versions.add(version);
  }
  db.exec('CREATE TABLE IF NOT EXISTS schema_versions(version INTEGER PRIMARY KEY)');
  const applied = db.prepare('SELECT version FROM schema_versions WHERE version=?');
  const record = db.prepare('INSERT OR IGNORE INTO schema_versions(version) VALUES(?)');
  for (const { name, version } of migrations) {
    const sql = fs.readFileSync(path.join(directory, name), 'utf8');
    db.transaction(() => {
      if (applied.get(version)) return;
      db.exec(sql);
      record.run(version);
    }).immediate();
  }
}
module.exports = { migrate };
