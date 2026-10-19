const {fork}=require('node:child_process');const path=require('node:path');const {randomUUID}=require('node:crypto');const {error}=require('../errors');
function createNasSupervisor({spawn,timeoutMs=30000,retryMs=15000}={}) {
  let child=null,pending=null,unhealthy=false,stuck=false,nextAttempt=0,stopped=false,lastVerified=null;
  function ensureChild() {
    if(child)return;
    child=spawn?spawn():fork(path.join(__dirname,'worker.js'),[],{stdio:['ignore','ignore','ignore','ipc'],serialization:'advanced',windowsHide:true});
    child.on('message',message=>{
      if(!pending||message.id!==pending.id||unhealthy)return;
      const p=pending;pending=null;clearTimeout(p.timer);
      if(message.error){p.reject(error(message.error));return;}
      lastVerified=Date.now();p.resolve(message.result);
    });
    child.on('exit',()=>{child=null;stuck=false;if(pending){clearTimeout(pending.timer);pending.reject(error('NAS_UNAVAILABLE'));pending=null;}nextAttempt=Date.now()+retryMs;});
    child.on('error',()=>fail());
  }
  function fail() {
    unhealthy=true;stuck=!!child;nextAttempt=Date.now()+retryMs;
    if(pending){clearTimeout(pending.timer);pending.reject(error('NAS_UNAVAILABLE'));pending=null;}
    child?.kill('SIGTERM');
  }
  function request(op,payload) {
    if(stopped||(unhealthy&&child)||Date.now()<nextAttempt)return Promise.reject(error('NAS_UNAVAILABLE'));
    if(pending)return Promise.reject(error('NAS_BUSY'));
    unhealthy=false;ensureChild();const id=randomUUID();
    return new Promise((resolve,reject)=>{
      pending={id,resolve,reject,timer:setTimeout(fail,timeoutMs)};
      try{child.send({id,op,payload},err=>{if(err)fail();});}catch{fail();}
    });
  }
  return {request,status:()=>({available:!unhealthy&&lastVerified!=null,stuck,busy:!!pending,lastVerified,nextAttempt}),
    stop(){stopped=true;fail();}};
}
module.exports={createNasSupervisor};
