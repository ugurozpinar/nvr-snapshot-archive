const {test}=require('node:test');const assert=require('node:assert/strict');const http=require('node:http');
const {jpeg}=require('../helpers/context');
test('snapshot adapter authenticates challenge and rejects invalid responses',async t=>{
  const {captureSnapshot}=require('../../src/capture/nvr-client');const image=await jpeg();
  const server=http.createServer((req,res)=>{
    if(!req.headers.authorization){res.writeHead(401,{'WWW-Authenticate':'Digest realm="nvr", nonce="abc123", qop="auth", algorithm=MD5'});return res.end();}
    const channel=new URL(req.url,'http://local').searchParams.get('channel');
    if(channel==='2'){res.writeHead(200,{'Content-Type':'text/html'});return res.end('login failed');}
    if(channel==='3'){res.writeHead(401);return res.end();}
    if(channel==='4')return;
    res.writeHead(200,{'Content-Type':'image/jpeg'});res.end(channel==='5'?image.subarray(0,20):image);
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});
  const nvr={host:`http://127.0.0.1:${server.address().port}`,username:'admin',password:'fixture-secret'};
  assert.ok((await captureSnapshot({nvr,channel:1})).buffer.equals(image));
  await assert.rejects(captureSnapshot({nvr,channel:2}),{code:'INVALID_IMAGE'});
  await assert.rejects(captureSnapshot({nvr,channel:3}),{code:'AUTH_FAILED'});
  await assert.rejects(captureSnapshot({nvr,channel:4,timeoutMs:50}),{code:'CAPTURE_TIMEOUT'});
  await assert.rejects(captureSnapshot({nvr,channel:5}),{code:'INVALID_IMAGE'});
  await assert.rejects(captureSnapshot({nvr,channel:1,maxBytes:10}),{code:'IMAGE_TOO_LARGE'});
});
