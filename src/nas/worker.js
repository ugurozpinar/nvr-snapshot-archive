const fs=require('node:fs/promises');const path=require('node:path');const crypto=require('node:crypto');
const {safePath,syncDir}=require('../archive/local-store');const {error}=require('../errors');
function decodeMount(value){return value.replace(/\\([0-7]{3})/g,(_,n)=>String.fromCharCode(parseInt(n,8)));}
async function linuxMount(root) {
  if(process.platform!=='linux')throw error('NAS_REQUIRES_LINUX');
  const text=await fs.readFile('/proc/self/mountinfo','utf8');let best=null;
  for(const line of text.trim().split('\n')){
    const [left,right]=line.split(' - ');if(!right)continue;
    const fields=left.split(' '),r=right.split(' '),mountPoint=decodeMount(fields[4]);
    if(root===mountPoint||root.startsWith(mountPoint+'/'))if(!best||mountPoint.length>best.mountPoint.length)best={mountPoint,source:decodeMount(r[1])};
  }
  if(!best)throw error('NAS_WRONG_MOUNT');return best;
}
function createNasOperations({mountProbe=linuxMount}={}) {
  async function verify(settings,initializing=false) {
    if(!settings?.nasPath||!settings.mountPoint||!settings.mountSource||!settings.depotId)throw error('NAS_CONFIG_REQUIRED');
    const root=path.resolve(settings.nasPath),mount=await mountProbe(root);
    if(mount.mountPoint!==settings.mountPoint||mount.source!==settings.mountSource)throw error('NAS_WRONG_MOUNT');
    if(await fs.realpath(root)!==root)throw error('NAS_SYMLINK');
    if(!initializing){const id=await fs.readFile(path.join(root,'.camera-archive-id'),'utf8');if(id.trim()!==settings.depotId)throw error('NAS_WRONG_DEPOT');}
    return root;
  }
  async function target(root,relative,create=false) {
    const result=safePath(root,relative);const parts=path.relative(root,path.dirname(result)).split(path.sep).filter(Boolean);let dir=root;
    for(const part of parts){dir=path.join(dir,part);if(create)await fs.mkdir(dir).catch(e=>{if(e.code!=='EEXIST')throw e;});const st=await fs.lstat(dir);if(st.isSymbolicLink()||!st.isDirectory())throw error('NAS_SYMLINK');}
    const stat=await fs.lstat(result).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(stat?.isSymbolicLink())throw error('NAS_SYMLINK');return result;
  }
  return async function execute(op,payload) {
    const root=await verify(payload.settings,op==='initialize');
    const tour=crypto.randomUUID();
    if(op==='initialize'){
      const marker=path.join(root,'.camera-archive-id');
      const h=await fs.open(marker,'wx',0o600);try{await h.writeFile(payload.settings.depotId);await h.sync();}finally{await h.close();}
      await syncDir(root);return {initialized:true};
    }
    if(op==='health'){const s=await fs.statfs(root);return {tour,freeBytes:Number(s.bavail)*Number(s.bsize),verifiedAt:Date.now()};}
    if(op==='transfer'){
      const dest=await target(root,payload.relativePath,true);
      const existing=await fs.readFile(dest).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
      const valid=b=>b.length===payload.bytes&&crypto.createHash('sha256').update(b).digest('hex')===payload.checksum;
      if(existing){if(!valid(existing))throw error('NAS_CONFLICT');return {verified:true};}
      const data=await fs.readFile(payload.source);if(!valid(data))throw error('LOCAL_CHECKSUM_FAILED');
      const temp=await target(root,payload.relativePath+'.part',true),h=await fs.open(temp,'w',0o600);
      try{await h.writeFile(data);await h.sync();}finally{await h.close();}
      if(!valid(await fs.readFile(temp)))throw error('NAS_CHECKSUM_FAILED');
      await verify(payload.settings);await fs.rename(temp,dest);await syncDir(path.dirname(dest));return {verified:true};
    }
    let filename;
    try{filename=await target(root,payload.relativePath);}catch(e){if(e.code==='ENOENT'&&op==='stat')return{exists:false,tour};throw e;}
    if(op==='stat'){const s=await fs.stat(filename).catch(e=>{if(e.code==='ENOENT')return null;throw e;});return {exists:!!s,bytes:s?.size,tour};}
    if(op==='read'){
      const length=Math.min(Math.max(payload.length||262144,1),262144),offset=Math.max(payload.offset||0,0);
      const h=await fs.open(filename,'r');try{const b=Buffer.alloc(length);const {bytesRead}=await h.read(b,0,length,offset);return {buffer:b.subarray(0,bytesRead),eof:bytesRead<length};}finally{await h.close();}
    }
    if(op==='delete'){await fs.unlink(filename).catch(e=>{if(e.code!=='ENOENT')throw e;});await syncDir(path.dirname(filename));return{deleted:true};}
    throw error('NAS_INVALID_OPERATION');
  };
}
if(require.main===module){
  const execute=createNasOperations();let busy=false;
  process.on('message',async m=>{
    if(busy){process.send?.({id:m.id,error:'NAS_BUSY'});return;}busy=true;
    try{process.send?.({id:m.id,result:await execute(m.op,m.payload)});}catch(e){process.send?.({id:m.id,error:e.code||'NAS_IO_ERROR'});}finally{busy=false;}
  });
  process.on('disconnect',()=>process.exit(0));
}
module.exports={createNasOperations,linuxMount};
