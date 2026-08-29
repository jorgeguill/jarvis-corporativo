// GET /api/dbcheck — termômetro do banco (Neon). Diz só SE conectou e quantos fatos
// existem. NÃO expõe dados, valores nem a connection string. Serve para confirmar,
// do lado do dev, que o DATABASE_URL foi ligado corretamente.
'use strict';

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  var hasDb = !!process.env.DATABASE_URL;
  if (!hasDb) { res.statusCode = 200; return res.end(JSON.stringify({ hasDb: false, ok: false, msg: 'DATABASE_URL nao configurado' })); }
  try {
    var neon = require('./_neon');
    var rows = await neon.neonQuery('SELECT count(*)::int AS n FROM fato', []);
    var n = rows && rows[0] ? Number(rows[0].n) : 0;
    res.statusCode = 200; return res.end(JSON.stringify({ hasDb: true, ok: true, fatos: n }));
  } catch (e) {
    res.statusCode = 200; return res.end(JSON.stringify({ hasDb: true, ok: false, msg: String(e).slice(0, 120) }));
  }
};
