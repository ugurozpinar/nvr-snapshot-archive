const sharp = require('sharp');
const {error}=require('../errors');
async function captureSnapshot({nvr,channel,signal,timeoutMs=20000,maxBytes=20*1024*1024}) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted)controller.abort();
  try {
    const {default:DigestFetch}=await import('digest-fetch');
    const base=nvr.host.includes('://')?nvr.host:`http://${nvr.host}`;
    const url=new URL('/cgi-bin/snapshot.cgi',base);url.searchParams.set('channel',channel);
    const client=new DigestFetch(nvr.username,nvr.password,{algorithm:'MD5'});
    const response=await client.fetch(url.toString(),{signal:controller.signal,redirect:'error'});
    if(response.status===401||response.status===403) {await response.body?.cancel();throw error('AUTH_FAILED');}
    if(!response.ok){await response.body?.cancel();throw error('NVR_HTTP_ERROR');}
    if(!/^image\/jpe?g(?:;|$)/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();throw error('INVALID_IMAGE');}
    const chunks=[];let bytes=0;
    for await (const chunk of response.body) {
      bytes+=chunk.length;if(bytes>maxBytes){controller.abort();throw error('IMAGE_TOO_LARGE');}chunks.push(chunk);
    }
    const buffer=Buffer.concat(chunks);
    try {await sharp(buffer,{failOn:'warning',limitInputPixels:40000000}).raw().toBuffer();}catch{throw error('INVALID_IMAGE');}
    return {buffer,contentType:'image/jpeg'};
  } catch(e) {
    if(e.code==='IMAGE_TOO_LARGE')throw e;
    if(controller.signal.aborted)throw error('CAPTURE_TIMEOUT');
    if(['AUTH_FAILED','INVALID_IMAGE','NVR_HTTP_ERROR'].includes(e.code))throw e;
    throw error('NVR_UNREACHABLE');
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
module.exports={captureSnapshot};
