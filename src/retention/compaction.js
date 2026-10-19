const {compareImages}=require('./similarity');const {readImage}=require('../nas/transfer');const {deleteBatch}=require('./deletion');
async function compactCamera(cameraId,deps) {
  const {repos,clock={now:Date.now}}=deps,camera=repos.cameras.get(cameraId),settings=repos.settings.get('main');
  if(!camera?.calibrated||!settings?.compactionEnabled)return {deleted:0};
  const policyVersion=camera.policyVersion||1,key=`compaction:${cameraId}:${policyVersion}`;
  const progress=repos.settings.get(key)||{};let reference=progress.referenceId?repos.images.get(progress.referenceId):null;
  const images=repos.images.list({cameraId,to:clock.now()-168*3600000+1,after:progress.after,limit:200});
  const victims=[];let after=progress.after;
  for(const image of images){
    if(image.state==='pending'||image.availability==='missing'||image.availability==='unavailable')break;
    if(!reference||image.capturedAt-reference.capturedAt>=Math.max(camera.anchorMs||3600000,camera.intervalMs||900000))reference=image;
    else{
      let comparison;
      try{comparison=await compareImages(await readImage(reference.id,deps),await readImage(image.id,deps),camera);}catch{break;}
      if(comparison.similar)victims.push({...image,policyVersion});else reference=image;
    }
    after={time:image.capturedAt,id:image.id};
  }
  if(victims.length)await deleteBatch(victims,'similarity',deps);
  // Cursor advances only after all physical deletion and summaries committed.
  repos.settings.save({id:key,referenceId:reference?.id,after});return {deleted:victims.length};
}
module.exports={compactCamera};
