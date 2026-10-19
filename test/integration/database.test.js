const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
test('catalog persists settings and rolls back transactions',()=>{
  const {openDatabase}=require('../../src/db/open');
  const {createRepositories}=require('../../src/db/repositories');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'archive-db-'));
  let db=openDatabase(path.join(dir,'db.sqlite')); let r=createRepositories(db);
  r.settings.save({id:'main',quotaBytes:1000});
  assert.throws(()=>db.transaction(()=>{r.settings.save({id:'main',quotaBytes:10});throw Error('rollback');})());
  db.close();db=openDatabase(path.join(dir,'db.sqlite'));r=createRepositories(db);
  assert.equal(r.settings.get('main').quotaBytes,1000);db.close();fs.rmSync(dir,{recursive:true,force:true});
});
test('secrets reject wrong keys and config isolates local paths',()=>{
  const {encryptSecret,decryptSecret}=require('../../src/security/secrets');
  const {loadConfig}=require('../../src/config');
  const key=Buffer.alloc(32,1).toString('hex');
  const encrypted=encryptSecret('test-password',key);
  assert.ok(!encrypted.includes('test-password'));assert.equal(decryptSecret(encrypted,key),'test-password');
  assert.throws(()=>decryptSecret(encrypted,Buffer.alloc(32,2).toString('hex')));
  assert.throws(()=>loadConfig({ARCHIVE_KEY:'bad'},process.cwd()));
  const c=loadConfig({ARCHIVE_KEY:key},process.cwd());assert.equal(c.archiveRoot,path.join(process.cwd(),'archive'));
});
