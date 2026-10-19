const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {openDatabase}=require('../../src/db/open');const {createRepositories}=require('../../src/db/repositories');
const {loadConfig}=require('../../src/config');
function context(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cam-archive-'));
  const config=loadConfig({ARCHIVE_KEY:Buffer.alloc(32,7).toString('hex'),SETUP_TOKEN:'test-setup'},dir);
  const db=openDatabase(config.databasePath),repos=createRepositories(db);
  repos.settings.save({id:'main',quotaBytes:1024**3,spoolQuotaBytes:512*1024**2,nasPath:null});
  t.after(()=>{db.close();fs.rmSync(dir,{recursive:true,force:true});});return {dir,config,db,repos};
}
async function jpeg(color='#333',width=100,height=80) { return require('sharp')({create:{width,height,channels:3,background:color}}).jpeg().toBuffer(); }
module.exports={context,jpeg};
