const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { context } = require('../helpers/context');
const { migrate } = require('../../src/db/migrate');

test('migrations run in numeric order once and roll back failed schema changes', (t) => {
  const { db, dir } = context(t);
  const migrations = path.join(dir, 'migrations');
  fs.mkdirSync(migrations);
  fs.writeFileSync(
    path.join(migrations, '002-example.sql'),
    'CREATE TABLE example(value INTEGER); INSERT INTO example VALUES(1);',
  );
  fs.writeFileSync(path.join(migrations, '010-update.sql'), 'UPDATE example SET value=value+1;');
  migrate(db, migrations);
  migrate(db, migrations);
  assert.equal(db.prepare('SELECT value FROM example').get().value, 2);
  fs.writeFileSync(
    path.join(migrations, '011-failure.sql'),
    'CREATE TABLE partial(value INTEGER); INSERT INTO nonexistent VALUES(1);',
  );
  assert.throws(() => migrate(db, migrations));
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='partial'").get(), undefined);
  assert.equal(db.prepare('SELECT version FROM schema_versions WHERE version=11').get(), undefined);
  fs.writeFileSync(
    path.join(migrations, '011-failure.sql'),
    'CREATE TABLE partial(value INTEGER);',
  );
  migrate(db, migrations);
  assert.equal(
    db.prepare('SELECT version FROM schema_versions WHERE version=11').get().version,
    11,
  );
});

test('recent image queries isolate cameras and resolve timestamp ties deterministically', (t) => {
  const { repos } = context(t);
  for (const image of [
    { id: 'a', cameraId: 'one', capturedAt: 100 },
    { id: 'b', cameraId: 'one', capturedAt: 100 },
    { id: 'c', cameraId: 'two', capturedAt: 200 },
    { id: 'd', cameraId: 'one', capturedAt: 50 },
  ])
    repos.images.save(image);
  assert.deepEqual(
    repos.images.recent('one', 2).map((image) => image.id),
    ['b', 'a'],
  );
  assert.deepEqual(repos.images.recent('missing'), []);
  assert.equal(repos.images.recent('two')[0].id, 'c');
});
test('catalog persists settings and rolls back transactions', () => {
  const { openDatabase } = require('../../src/db/open');
  const { createRepositories } = require('../../src/db/repositories');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-db-'));
  let db = openDatabase(path.join(dir, 'db.sqlite'));
  let r = createRepositories(db);
  r.settings.save({ id: 'main', quotaBytes: 1000 });
  assert.throws(() =>
    db.transaction(() => {
      r.settings.save({ id: 'main', quotaBytes: 10 });
      throw Error('rollback');
    })(),
  );
  db.close();
  db = openDatabase(path.join(dir, 'db.sqlite'));
  r = createRepositories(db);
  assert.equal(r.settings.get('main').quotaBytes, 1000);
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
test('secrets reject wrong keys and config isolates local paths', () => {
  const { encryptSecret, decryptSecret } = require('../../src/security/secrets');
  const { loadConfig } = require('../../src/config');
  const key = Buffer.alloc(32, 1).toString('hex');
  const encrypted = encryptSecret('test-password', key);
  assert.ok(!encrypted.includes('test-password'));
  assert.equal(decryptSecret(encrypted, key), 'test-password');
  assert.throws(() => decryptSecret(encrypted, Buffer.alloc(32, 2).toString('hex')));
  assert.throws(() => loadConfig({ ARCHIVE_KEY: 'bad' }, process.cwd()));
  const c = loadConfig({ ARCHIVE_KEY: key }, process.cwd());
  assert.equal(c.archiveRoot, path.join(process.cwd(), 'archive'));
});
