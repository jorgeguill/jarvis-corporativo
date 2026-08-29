// /api/decisions  — Decision Ledger (§8)
//   POST { empresa, problema, objetivo, recomendacao, evidencias, confianca, responsavel }
//   GET  ?empresa=SKAL[&limite=30]
// Na F1 grava recomendação + evidência (a rastreabilidade "por que decidimos isso?").
// Aprovação e resultado_real são preenchidos na F4.
'use strict';
const { sql, newTrace } = require('../lib/db');
const { authOk } = require('../lib/auth');
const { send, readBody, noDB } = require('../lib/http');

module.exports = async (req, res) => {
  if (!authOk(req)) return send(res, 401, { error: 'nao_autorizado' });
  try {
    if (req.method === 'GET') {
      const u = new URL(req.url, 'http://x');
      const empresa = (u.searchParams.get('empresa') || 'SKAL').trim();
      const limite = Math.min(parseInt(u.searchParams.get('limite') || '30', 10) || 30, 100);
      const rows = await sql`
        SELECT d.id, d.problema, d.objetivo, d.recomendacao, d.confianca,
               d.responsavel, d.aprovacao, d.status, d.resultado_esperado,
               d.resultado_real, d.created_at
          FROM decisao d JOIN empresa e ON e.id = d.empresa_id
         WHERE e.codigo = ${empresa}
         ORDER BY d.created_at DESC LIMIT ${limite}`;
      return send(res, 200, { empresa, decisoes: rows });
    }
    if (req.method === 'POST') {
      const b = await readBody(req);
      const empresa = String(b.empresa || '').trim();
      if (!empresa || !b.problema) return send(res, 400, { error: 'empresa_e_problema_obrigatorios' });
      const emp = await sql`SELECT id FROM empresa WHERE codigo = ${empresa}`;
      if (!emp.length) return send(res, 404, { error: 'empresa_desconhecida' });
      const trace = newTrace();
      const r = await sql`
        INSERT INTO decisao (empresa_id, problema, objetivo, recomendacao, evidencias,
                             confianca, responsavel, status, trace_id)
        VALUES (${emp[0].id}, ${b.problema}, ${b.objetivo || null}, ${b.recomendacao || null},
                ${JSON.stringify(b.evidencias || {})}::jsonb, ${b.confianca == null ? null : b.confianca},
                ${b.responsavel || null}, 'aberta', ${trace})
        RETURNING id`;
      return send(res, 200, { ok: true, decision_id: r[0].id, trace_id: trace });
    }
    return send(res, 405, { error: 'metodo' });
  } catch (e) {
    if (e.code === 'NO_DB') return noDB(res);
    return send(res, 500, { error: 'erro', detalhe: String(e).slice(0, 200) });
  }
};
