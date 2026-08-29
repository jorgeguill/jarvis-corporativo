// POST /api/ingest  { empresa, fonte, fatos:[{metrica,valor,unidade_med,data_ref,confianca}], lancamentos:[...] }
// Recebe um lote normalizado, grava fatos/lançamentos (upsert) e emite eventos.
// É o caminho de entrada de dados que substitui a edição manual do data.js.
'use strict';
const { sql, newTrace } = require('../lib/db');
const { authOk } = require('../lib/auth');
const { send, readBody, noDB } = require('../lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'metodo' });
  if (!authOk(req)) return send(res, 401, { error: 'nao_autorizado' });
  const body = await readBody(req);
  const empresa = String(body.empresa || '').trim();
  const fatos = Array.isArray(body.fatos) ? body.fatos : [];
  if (!empresa) return send(res, 400, { error: 'empresa_obrigatoria' });
  const trace = newTrace();
  try {
    const emp = await sql`SELECT id FROM empresa WHERE codigo = ${empresa}`;
    if (!emp.length) return send(res, 404, { error: 'empresa_desconhecida' });
    const empId = emp[0].id;
    const fnt = await sql`INSERT INTO fonte (tipo, nome) VALUES ('upload', ${String(body.fonte || 'upload')}) RETURNING id`;
    const fonteId = fnt[0].id;

    let n = 0;
    for (const f of fatos) {
      if (!f || !f.metrica || f.valor == null || !f.data_ref) continue;
      // upsert: 1 fato por (empresa, unidade, metrica, data) — a chave da fonte única
      await sql`
        INSERT INTO fato (empresa_id, metrica, valor, unidade_med, data_ref, fonte_id, confianca, trace_id)
        VALUES (${empId}, ${f.metrica}, ${f.valor}, ${f.unidade_med || null}, ${f.data_ref}, ${fonteId}, ${f.confianca == null ? 1 : f.confianca}, ${trace})
        ON CONFLICT (empresa_id, unidade_id, metrica, data_ref)
        DO UPDATE SET valor = EXCLUDED.valor, unidade_med = EXCLUDED.unidade_med,
                      confianca = EXCLUDED.confianca, fonte_id = EXCLUDED.fonte_id,
                      trace_id = EXCLUDED.trace_id, created_at = now()`;
      // outbox: toda escrita de fato gera um evento
      await sql`
        INSERT INTO evento (tipo, origem, empresa_id, entidade_tipo, entidade_id, valor, contexto, trace_id)
        VALUES ('FATO_ATUALIZADO', 'ingest', ${empId}, 'fato', ${f.metrica}, ${f.valor},
                ${JSON.stringify({ data_ref: f.data_ref })}::jsonb, ${trace})`;
      n++;
    }
    await sql`INSERT INTO ingestao (fonte_id, empresa_id, status, linhas, trace_id, concluido_em)
              VALUES (${fonteId}, ${empId}, 'ok', ${n}, ${trace}, now())`;
    await sql`INSERT INTO evento (tipo, origem, empresa_id, valor, trace_id)
              VALUES ('INGESTAO_CONCLUIDA', 'ingest', ${empId}, ${n}, ${trace})`;
    return send(res, 200, { ok: true, empresa, fatos_gravados: n, trace_id: trace });
  } catch (e) {
    if (e.code === 'NO_DB') return noDB(res);
    return send(res, 500, { error: 'erro', detalhe: String(e).slice(0, 200) });
  }
};
