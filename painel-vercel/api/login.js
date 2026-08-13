// R.A.D.A.R. — login por usuario. Valida no servidor e emite um token assinado.
const crypto = require('crypto');
function parseUsers(){
  var raw = process.env.RADAR_USERS || '';
  var m = {};
  raw.split(/[,\n]/).forEach(function(p){ var i=p.indexOf(':'); if(i>0){ var u=p.slice(0,i).trim(); var s=p.slice(i+1).trim(); if(u) m[u]=s; } });
  return Object.keys(m).length ? m : null;
}
function secret(){ return process.env.RADAR_SECRET || crypto.createHash('sha256').update('radar|'+(process.env.RADAR_USERS||'')).digest('hex'); }
function b64u(buf){ return Buffer.from(buf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function mac(p){ return crypto.createHmac('sha256', secret()).update(p).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function sign(user){ var p=b64u(JSON.stringify({u:user, exp:Date.now()+7*24*3600*1000})); return p+'.'+mac(p); }
function eq(a,b){ if(a==null||b==null) return false; var A=Buffer.from(String(a)), B=Buffer.from(String(b)); if(A.length!==B.length) return false; return crypto.timingSafeEqual(A,B); }

async function readBody(req){
  if (req.body) { try { return typeof req.body==='string'?JSON.parse(req.body):req.body; } catch(e){ return {}; } }
  return await new Promise(function(resolve){ var d=''; req.on('data',function(c){ d+=c; if(d.length>4000) req.destroy(); }); req.on('end',function(){ try{ resolve(JSON.parse(d||'{}')); }catch(e){ resolve({}); } }); });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(JSON.stringify({ error: 'metodo' })); }
  var users = parseUsers();
  if (!users) { res.statusCode = 200; return res.end(JSON.stringify({ auth: false })); }
  var body = await readBody(req);
  var user = String((body.user || '')).trim();
  var pass = String(body.pass || '');
  var stored = users[user];
  if (!stored || !eq(stored, pass)) { res.statusCode = 401; return res.end(JSON.stringify({ error: 'Usuário ou senha inválidos.' })); }
  res.statusCode = 200; return res.end(JSON.stringify({ token: sign(user), user: user }));
};
