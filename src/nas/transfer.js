const fs=require('node:fs/promises');const {error}=require('../errors');
async function runTransfers({repos,nas,history,store}) {
  const settings=repos.settings.get('main');if(!settings?.nasPath)return;
  for(const image of repos.images.list({state:'pending',limit:20})) {
    try{await store.withLease(image.id,async()=>{
      if(image.depotId!==settings.depotId)throw error('NAS_WRONG_DEPOT');
      await nas.request('transfer',{settings,source:image.localPath,relativePath:image.nasPath,bytes:image.bytes,checksum:image.checksum});
      repos.images.save({...image,state:'transferred',availability:'available',verifiedAt:Date.now()});
      await fs.unlink(image.localPath);repos.images.save({...image,state:'transferred',localPath:null,availability:'available',verifiedAt:Date.now()});
    });history.closeScope('nas');}
    catch(e){if(e.code==='IMAGE_BUSY')continue;if(e.code!=='NAS_BUSY')history.openPeriod('nas',e.code||'NAS_IO_ERROR');break;}
  }
}
async function verifyPresence(imageId,{repos,nas,history}) {
  const image=repos.images.get(imageId);if(!image||image.state!=='transferred')return;
  try{
    const r=await nas.request('stat',{settings:repos.settings.get('main'),relativePath:image.nasPath});
    if(r.exists){repos.images.save({...image,availability:'available',absentTours:[],verifiedAt:Date.now()});return;}
    const tours=[...new Set([...(image.absentTours||[]),r.tour])].slice(-2),missing=tours.length>=2;
    repos.images.save({...image,absentTours:tours,availability:missing?'missing':'unknown',verifiedAt:Date.now()});
    if(missing)history.openPeriod(image.cameraId,'FILE_MISSING',{start:image.capturedAt,end:image.capturedAt,imageId:image.id});
  }catch(e){if(e.code!=='NAS_BUSY')repos.images.save({...image,availability:'unavailable'});}
}
async function readImage(imageId,{repos,store,nas}) {
  const image=repos.images.get(imageId);if(!image)throw error('NOT_FOUND');
  if(image.localPath)return store.read(imageId);
  const chunks=[];let offset=0;
  while(offset<=20*1024*1024){
    const r=await nas.request('read',{settings:repos.settings.get('main'),relativePath:image.nasPath,offset,length:262144});
    chunks.push(Buffer.from(r.buffer));offset+=r.buffer.length;if(r.eof)return Buffer.concat(chunks);
  }
  throw error('IMAGE_TOO_LARGE');
}
module.exports={runTransfers,verifyPresence,readImage};
