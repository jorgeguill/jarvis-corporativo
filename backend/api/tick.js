// GET /api/tick  — o laço proativo (chamado pelo Vercel Cron, protegido por CRON_SECRET).
// Perceber -> Computar -> Detectar -> Registrar. Detecção 100% código (sem LLM).
// É aqui que o "vigia" deixa de ser frase no prompt e vira processo que roda sozinho.
'use strict';
const { sql, newTrace } = require('../lib/db');
const { cronOk } = require('../lib/auth');
const { send, noDB } = require('../lib/http');
const detectors = require('../lib/detectors');

async function ultimoFato(empId, metrica) {
  const r = await sql`SELECT valor FROM fato WHERE empresa_id = ${empId} AND metrica = ${metrica}
                      ORDER BY data_ref DESC LIMIT 1`;
  return r.length ? Number(r[0].valor) : 0;
}

module.exports = async (req, res) => {
  if (!cronOk(req)) return send(res, 401, { error: 'cron_nao_autorizado' });
  const trace = newTrace(), hoje = new Date();
  try {
    const empresas = await sql`SELECT id, codigo FROM empresa WHERE ativo = true`;
    let emitidos = 0;
    for (const emp of empresas) {
      // --- Computar: puxa os fatos-base (em milhares de R$, como o painel usa)
      const folha = await ultimoFato(emp.id, 'folha_liquida');
      const estaduais = await ultimoFato(emp.id, 'tributos_estaduais');
      const federais = await ultimoFato(emp.id, 'tributos_federais');

      // séries para o detector de desvio
      const sInad = await sql`SELECT data_ref AS data, valor FROM fato
                              WHERE empresa_id = ${emp.id} AND metrica = 'inadimplencia'
                              ORDER BY data_ref`;

      // --- Detectar (código puro)
      const eventos = detectors.runAll({
        empresa: emp.id, hoje: hoje,
        folhaLiquidaMensal: folha,
        tributosEstaduais: estaduais, tributosFederais: federais,
        series: [{ metrica: 'inadimplencia', serie: sInad }]
      });

      // --- Registrar (idempotente via chave_dedupe / índice único)
      for (const e of eventos) {
        const r = await sql`
          INSERT INTO evento (tipo, origem, empresa_id, entidade_tipo, entidade_id,
                              severidade, valor, contexto, evidencia, chave_dedupe, trace_id)
          VALUES (${e.tipo}, ${e.origem}, ${emp.id}, ${e.entidade_tipo || null}, ${e.entidade_id || null},
                  ${e.severidade}, ${e.valor}, ${JSON.stringify(e.contexto)}::jsonb,
                  ${JSON.stringify(e.evidencia)}::jsonb, ${e.chave_dedupe || null}, ${trace})
          ON CONFLICT (empresa_id, tipo, chave_dedupe) WHERE chave_dedupe IS NOT NULL
          DO NOTHING
          RETURNING id`;
        if (r.length) emitidos++;
      }
    }
    return send(res, 200, { ok: true, empresas: empresas.length, eventos_novos: emitidos, trace_id: trace });
  } catch (e) {
    if (e.code === 'NO_DB') return noDB(res);
    return send(res, 500, { error: 'erro', detalhe: String(e).slice(0, 200) });
  }
};
