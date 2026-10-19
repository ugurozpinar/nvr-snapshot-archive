const fs=require('node:fs/promises');const {randomUUID}=require('node:crypto');const {localDay}=require('../history/service');
async function deleteBatch(images,reason,deps,existingJob=null) {
  const {repos,store,nas,history}=deps;
  const job=existingJob||{id:randomUUID(),kind:'delete',reason,items:images.map(image=>({image,done:false}))};
  if(!existingJob)repos.jobs.save(job);
  for(const item of job.items){if(item.done)continue;const image=item.image;
    if(image.state==='pending')continue;
    await store.withLease(image.id,async()=>{
      if(image.state==='transferred')await nas.request('delete',{settings:repos.settings.get('main'),relativePath:image.nasPath});
      else if(image.localPath)await fs.unlink(image.localPath).catch(e=>{if(e.code!=='ENOENT')throw e;});
      item.done=true;repos.jobs.save(job);
    });
  }
  if(job.items.some(i=>!i.done))return;
  repos.transaction(()=>{
    const groups=new Map();for(const {image} of job.items){const key=`${image.cameraId}:${localDay(image.capturedAt)}`;const group=groups.get(key)||[];group.push(image);groups.set(key,group);}
    for(const [key,group] of groups){history.recordDeletionBatch({id:`${job.id}:${key}`,cameraId:group[0].cameraId,reason:job.reason,from:Math.min(...group.map(i=>i.capturedAt)),to:Math.max(...group.map(i=>i.capturedAt)),count:group.length,bytes:group.reduce((n,i)=>n+i.bytes,0),policyVersion:group[0].policyVersion||1});}
    for(const {image} of job.items)repos.images.remove(image.id);
    repos.jobs.remove(job.id);
  });
}
async function recoverDeletes(deps){for(const job of deps.repos.jobs.list({kind:'delete',limit:100}))await deleteBatch([],job.reason,deps,job);}
module.exports={deleteBatch,recoverDeletes};
