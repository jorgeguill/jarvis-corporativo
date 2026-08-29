// GET /api/events?empresa=SKAL[&desde=ISO][&limite=50]
// Feed de eventos que o tick gerou — alimenta o painel proativo.
'use strict';
const { sql } = require('../lib/db');
const { authOk } = require('../lib/auth');
const { send, noDB } = require('../lib/http');

module.exports = async (req, res) => {
  if (!authOk(req)) return send(res, 401, { error: 'nao_autorizado' });
  const u = new URL(req.url, 'http://x');
  const empresa = (u.searchParams.get('empresa') || 'SKAL').trim();
  const desde = (u.searchParams.get('desde') || '1900-01-01').trim();
  const limite = Math.min(parseInt(u.searchParams.get('limite') || '50', 10) || 50, 200);
  try {
    const rows = await sql`
      SELECT ev.tipo, ev.origem, ev.severidade, ev.valor, ev.contexto, ev.evidencia, ev.ts
        FROM evento ev JOIN empresa e ON e.id = ev.empresa_id
       WHERE e.codigo = ${empresa} AND ev.ts >= ${desde}
       ORDER BY ev.ts DESC LIMIT ${limite}`;
    return send(res, 200, { empresa, eventos: rows });
  } catch (e) {
    if (e.code === 'NO_DB') return noDB(res);
    return send(res, 500, { error: 'erro', detalhe: String(e).slice(0, 200) });
  }
};
