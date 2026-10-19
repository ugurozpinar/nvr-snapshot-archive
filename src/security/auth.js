const argon2=require('argon2');const crypto=require('node:crypto');
function createAuth({repos,config,now=Date.now}) {
  const sessions=new Map(),attempts=new Map();const lifetime=8*3600000;
  const equal=(a,b)=>{const aa=Buffer.from(String(a||'')),bb=Buffer.from(String(b||''));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);};
  function session(req){
    const id=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('archive_session='))?.slice(16);
    const s=sessions.get(id);if(!s||s.expires<now()){sessions.delete(id);return null;}return {...s,id};
  }
  function grant(req,res){
    for(const [id,s] of sessions)if(s.expires<now())sessions.delete(id);
    if(sessions.size>=100)sessions.delete(sessions.keys().next().value);
    const id=crypto.randomBytes(32).toString('hex'),csrf=crypto.randomBytes(32).toString('hex');sessions.set(id,{csrf,expires:now()+lifetime});
    res.cookie('archive_session',id,{httpOnly:true,sameSite:'strict',secure:req.secure,maxAge:lifetime,path:'/'});return {csrf};
  }
  function allowed(req,res){
    const origin=req.headers.origin;if(origin){try{if(new URL(origin).host!==req.headers.host){res.status(403).json({error:'ORIGIN_REJECTED'});return false;}}catch{res.status(403).json({error:'ORIGIN_REJECTED'});return false;}}
    const key=req.ip||'local',row=attempts.get(key)||{count:0,start:now()};
    if(now()-row.start>900000){row.count=0;row.start=now();}
    row.count++;if(attempts.size>1000)attempts.clear();attempts.set(key,row);
    if(row.count>10){res.status(429).json({error:'LOGIN_RATE_LIMIT'});return false;}return true;
  }
  return {session,
    info(req){const s=session(req);return {setupRequired:!repos.settings.get('admin'),authenticated:!!s,csrf:s?.csrf};},
    async setup(req,res){
      if(!allowed(req,res))return;
      if(repos.settings.get('admin'))return res.status(409).json({error:'ALREADY_CONFIGURED'});
      if(!config.setupToken||!equal(req.body.token,config.setupToken))return res.status(403).json({error:'SETUP_TOKEN_INVALID'});
      if(typeof req.body.password!=='string'||req.body.password.length<12||req.body.password.length>256)return res.status(400).json({error:'PASSWORD_LENGTH_12_256'});
      const hash=await argon2.hash(req.body.password,{type:argon2.argon2id});
      if(repos.settings.get('admin'))return res.status(409).json({error:'ALREADY_CONFIGURED'});
      repos.settings.save({id:'admin',hash});res.json(grant(req,res));
    },
    async login(req,res){
      if(!allowed(req,res))return;const admin=repos.settings.get('admin');
      if(typeof req.body.password!=='string'||req.body.password.length>256||!admin||!await argon2.verify(admin.hash,req.body.password))return res.status(401).json({error:'LOGIN_FAILED'});
      res.json(grant(req,res));
    },
    require(req,res,next){const s=session(req);if(!s)return res.status(401).json({error:'AUTH_REQUIRED'});
      if(!['GET','HEAD'].includes(req.method)&&!equal(req.headers['x-csrf-token'],s.csrf))return res.status(403).json({error:'CSRF_INVALID'});req.session=s;next();},
    logout(req,res){sessions.delete(req.session.id);res.clearCookie('archive_session',{path:'/'});res.json({ok:true});}
  };
}
module.exports={createAuth};
