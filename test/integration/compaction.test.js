const {test}=require('node:test');const assert=require('node:assert/strict');const sharp=require('sharp');const {context,jpeg}=require('../helpers/context');
test('clock mask excludes clock differences without modifying original and conservatively retains errors',async()=>{
  const {compareImages}=require('../../src/retention/similarity');const a=await jpeg('#222',100,100);
  const patch=await sharp({create:{width:20,height:10,channels:3,background:'#fff'}}).png().toBuffer();
  const b=await sharp(a).composite([{input:patch,left:0,top:0}]).jpeg().toBuffer();const copy=Buffer.from(a);
  assert.equal((await compareImages(a,b,{masks:[],sensitivity:'high'})).similar,false);
  assert.equal((await compareImages(a,b,{masks:[{x:0,y:0,width:.3,height:.2}],sensitivity:'medium'})).similar,true);
  assert.ok(a.equals(copy));assert.equal((await compareImages(a,Buffer.from('bad'),{masks:[]})).similar,false);
  await assert.rejects(compareImages(a,b,{masks:[{x:0,y:0,width:1,height:1}]}),{code:'INVALID_MASK'});
});
test('compaction protects 168 hours and hourly anchors and is idempotent',async t=>{
  const {compactCamera}=require('../../src/retention/compaction');const {createLocalStore}=require('../../src/archive/local-store');const {createHistory}=require('../../src/history/service');
  const ctx=context(t),store=createLocalStore(ctx),now=Date.UTC(2026,9,19),history=createHistory(ctx);
  ctx.repos.settings.save({...ctx.repos.settings.get('main'),compactionEnabled:true});
  ctx.repos.cameras.save({id:'cam',intervalMs:900000,anchorMs:3600000,policyVersion:1,masks:[],calibrated:true});
  const old=now-8*86400000,buffer=await jpeg();
  for(let i=0;i<6;i++)await store.persist({id:`old-${i}`,cameraId:'cam',capturedAt:old+i*900000,buffer});
  await store.persist({id:'young',cameraId:'cam',capturedAt:now-168*3600000+1,buffer});
  const deps={...ctx,store,history,clock:{now:()=>now}};
  await compactCamera('cam',deps);await compactCamera('cam',deps);
  assert.deepEqual(ctx.repos.images.list().map(x=>x.id),['old-0','old-4','young']);
  assert.equal(history.summarize('cam','2026-10-11').deleted.similarity,4);
});
