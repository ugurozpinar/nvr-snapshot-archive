const crypto = require('node:crypto');
function keyBuffer(key) { if (!/^[a-f0-9]{64}$/i.test(key||'')) throw Error('Invalid encryption key'); return Buffer.from(key,'hex'); }
function encryptSecret(text,key) {
  const iv=crypto.randomBytes(12), cipher=crypto.createCipheriv('aes-256-gcm',keyBuffer(key),iv);
  const encrypted=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]);
  return [iv,cipher.getAuthTag(),encrypted].map(b=>b.toString('base64')).join('.');
}
function decryptSecret(text,key) {
  const [iv,tag,body]=text.split('.').map(x=>Buffer.from(x,'base64'));
  const decipher=crypto.createDecipheriv('aes-256-gcm',keyBuffer(key),iv);decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body),decipher.final()]).toString('utf8');
}
module.exports={encryptSecret,decryptSecret};
