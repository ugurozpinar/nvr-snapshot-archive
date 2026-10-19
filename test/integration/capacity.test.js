const {test}=require('node:test');const assert=require('node:assert/strict');const {context,jpeg}=require('../helpers/context');
test('capacity at 95 percent deletes oldest to 90 percent, including young anchors, never pending',async t=>{
  const {enforceCapacity}=require('../../src/retention/capacity');const {createLocalStore}=require('../../src/archive/local-store');const {createHistory}=require('../../src/history/service');
  const ctx=context(t),store=createLocalStore(ctx),history=createHistory(ctx),buffer=await jpeg();
  for(let i=0;i<10;i++)await store.persist({id:`i${i}`,cameraId:'cam',capturedAt:Date.now()+i,buffer});
  ctx.repos.settings.save({...ctx.repos.settings.get('main'),quotaBytes:Math.floor(buffer.length*10/.949)});
  await enforceCapacity({...ctx,store,history});assert.equal(ctx.repos.images.list().length,10);
  ctx.repos.settings.save({...ctx.repos.settings.get('main'),quotaBytes:buffer.length*10});
  await enforceCapacity({...ctx,store,history});assert.equal(ctx.repos.images.list().length,9);assert.equal(ctx.repos.images.get('i0'),null);
  ctx.repos.images.save({id:'pending',cameraId:'cam',state:'pending',capturedAt:0,bytes:buffer.length});
  await enforceCapacity({...ctx,store,history});assert.ok(ctx.repos.images.get('pending'));
});
