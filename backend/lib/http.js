// R.A.D.A.R. — utilidades HTTP compartilhadas pelos endpoints da Fase 1.
'use strict';
function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
async function readBody(req, cap) {
  cap = cap || 512 * 1024;
  if (req.body) { try { return typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch (e) { return {}; } }
  return await new Promise(function (resolve) {
    let d = '';
    req.on('data', function (c) { d += c; if (d.length > cap) req.destroy(); });
    req.on('end', function () { try { resolve(JSON.parse(d || '{}')); } catch (e) { resolve({}); } });
  });
}
// resposta padrão quando o banco ainda não foi ligado (Neon sem DATABASE_URL)
function noDB(res) { return send(res, 503, { error: 'db_offline', reply: 'Banco (Neon) ainda nao conectado. Configure DATABASE_URL.' }); }
module.exports = { send, readBody, noDB };
