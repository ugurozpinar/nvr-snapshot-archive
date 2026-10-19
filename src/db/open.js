const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { migrate } = require('./migrate');
function openDatabase(filename) {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), {recursive: true, mode: 0o700});
  const db = new Database(filename);
  db.pragma('journal_mode = WAL'); db.pragma('synchronous = FULL'); db.pragma('foreign_keys = ON');
  migrate(db); return db;
}
module.exports = {openDatabase};
