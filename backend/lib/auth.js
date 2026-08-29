// R.A.D.A.R. — autenticação compartilhada (mesmo esquema HMAC do app atual).
// Reaproveita RADAR_SECRET/RADAR_USERS já existentes; endpoints novos herdam o login.
'use strict';
const crypto = require('crypto');

function parseUsers() {
  const raw = process.env.RADAR_USERS || '', m = {};
  raw.split(/[,\n]/).forEach(function (p) { const i = p.indexOf(':'); if (i > 0) { const u = p.slice(0, i).trim(); if (u) m[u] = p.slice(i + 1).trim(); } });
  return Object.keys(m).length ? m : null;
}
function secret() { return process.env.RADAR_SECRET || crypto.createHash('sha256').update('radar|' + (process.env.RADAR_USERS || '')).digest('hex'); }
function mac(p) { return crypto.createHmac('sha256', secret()).update(p).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

// valida o token do usuário (header x-radar-auth ou ?t=)
function authOk(req) {
  if (!parseUsers()) return true;
  let tok = req.headers['x-radar-auth'];
  if (!tok) { try { tok = new URL(req.url, 'http://x').searchParams.get('t') || ''; } catch (e) { } }
  if (!tok || tok.indexOf('.') < 0) return false;
  const a = tok.split('.');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(mac(a[0])), Buffer.from(a[1]))) return false;
    const o = JSON.parse(Buffer.from(a[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    return o.exp && o.exp >= Date.now();
  } catch (e) { return false; }
}

// o /api/tick é chamado pelo Vercel Cron, não por usuário: protege por segredo próprio.
function cronOk(req) {
  const want = process.env.CRON_SECRET;
  if (!want) return false;                          // sem segredo => nega (fail-safe)
  const got = req.headers['x-cron-secret'] || (req.headers['authorization'] || '').replace(/^Bearer /, '');
  try { return crypto.timingSafeEqual(Buffer.from(String(got)), Buffer.from(want)); } catch (e) { return false; }
}

module.exports = { authOk, cronOk, parseUsers };
