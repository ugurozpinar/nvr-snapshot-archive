const fs=require('node:fs/promises');const path=require('node:path');const sharp=require('sharp');const {readImage}=require('../nas/transfer');
function createMedia(deps){const {config}=deps;let pruning=null;const inflight=new Map();
  async function prune(){
    const names=await fs.readdir(config.cacheRoot);const entries=await Promise.all(names.filter(n=>n.endsWith('.jpg')).map(async n=>{const file=path.join(config.cacheRoot,n),s=await fs.stat(file);return{file,size:s.size,time:s.mtimeMs};}));
    let bytes=entries.reduce((n,e)=>n+e.size,0);for(const e of entries.sort((a,b)=>a.time-b.time)){if(bytes<=config.cacheBytes)break;await fs.rm(e.file,{force:true});bytes-=e.size;}
  }
  async function thumbnail(id){
    const name=path.join(config.cacheRoot,id+'.jpg');
    const cached=await fs.readFile(name).catch(()=>null);if(cached)return cached;
    if(inflight.has(id))return inflight.get(id);
    const task=(async()=>{
      const original=await readImage(id,deps),buffer=await sharp(original).resize({width:360,withoutEnlargement:true}).jpeg({quality:65}).toBuffer();
      await fs.mkdir(config.cacheRoot,{recursive:true});await fs.writeFile(name,buffer,{mode:0o600});
      pruning=pruning||prune().finally(()=>{pruning=null;});await pruning;return buffer;
    })().finally(()=>inflight.delete(id));inflight.set(id,task);return task;
  }
  return {thumbnail,original:id=>readImage(id,deps)};
}
module.exports={createMedia};
