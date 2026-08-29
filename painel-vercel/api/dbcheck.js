// GET /api/dbcheck — termômetro do banco (Neon). Diz SE conectou, quantos fatos,
// os NOMES das métricas (não sensível) e quantos eventos o vigia já gerou.
// NÃO expõe valores, contexto nem a connection string.
'use strict';

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  var hasDb = !!process.env.DATABASE_URL;
  if (!hasDb) { res.statusCode = 200; return res.end(JSON.stringify({ hasDb: false, ok: false, msg: 'DATABASE_URL nao configurado' })); }
  try {
    var neon = require('./_neon');
    var f = await neon.neonQuery('SELECT count(*)::int AS n FROM fato', []);
    var m = await neon.neonQuery('SELECT DISTINCT metrica FROM fato ORDER BY metrica', []);
    var ev = await neon.neonQuery('SELECT count(*)::int AS n FROM evento', []);
    res.statusCode = 200;
    return res.end(JSON.stringify({
      hasDb: true, ok: true,
      fatos: f && f[0] ? Number(f[0].n) : 0,
      metricas: m.map(function (r) { return r.metrica; }),
      eventos: ev && ev[0] ? Number(ev[0].n) : 0
    }));
  } catch (e) {
    res.statusCode = 200; return res.end(JSON.stringify({ hasDb: true, ok: false, msg: String(e).slice(0, 120) }));
  }
};
