// GET /api/facts?empresa=SKAL&metrica=folha_liquida[&desde=YYYY-MM-DD]
// Série/valor de uma métrica. O número vive uma vez (tabela fato).
'use strict';
const { sql } = require('../lib/db');
const { authOk } = require('../lib/auth');
const { send, noDB } = require('../lib/http');

module.exports = async (req, res) => {
  if (!authOk(req)) return send(res, 401, { error: 'nao_autorizado' });
  const u = new URL(req.url, 'http://x');
  const empresa = (u.searchParams.get('empresa') || 'SKAL').trim();
  const metrica = (u.searchParams.get('metrica') || '').trim();
  const desde = (u.searchParams.get('desde') || '1900-01-01').trim();
  try {
    const rows = metrica
      ? await sql`SELECT f.metrica, f.valor, f.unidade_med, f.data_ref, f.confianca
                    FROM fato f JOIN empresa e ON e.id = f.empresa_id
                   WHERE e.codigo = ${empresa} AND f.metrica = ${metrica} AND f.data_ref >= ${desde}
                   ORDER BY f.data_ref`
      : await sql`SELECT f.metrica, f.valor, f.unidade_med, f.data_ref, f.confianca
                    FROM fato f JOIN empresa e ON e.id = f.empresa_id
                   WHERE e.codigo = ${empresa} AND f.data_ref >= ${desde}
                   ORDER BY f.data_ref DESC LIMIT 200`;
    return send(res, 200, { empresa, metrica: metrica || null, fatos: rows });
  } catch (e) {
    if (e.code === 'NO_DB') return noDB(res);
    return send(res, 500, { error: 'erro', detalhe: String(e).slice(0, 200) });
  }
};
