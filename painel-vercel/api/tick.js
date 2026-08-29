// GET /api/tick — o laço proativo (Vercel Cron, protegido por CRON_SECRET; também
// aceita o login do usuário para acionamento manual). Detecção 100% código (sem LLM).
// Passos: normaliza nomes de métrica -> lê fatos -> roda detectores -> grava eventos.
'use strict';
const { neonQuery } = require('./_neon');
const { cronOk, authOk } = require('./_auth');
const detectors = require('../lib/detectors');

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
async function ultimoFato(empId, metrica) {
  var r = await neonQuery('SELECT valor FROM fato WHERE empresa_id=$1 AND metrica=$2 ORDER BY data_ref DESC LIMIT 1', [empId, metrica]);
  return r.length ? Number(r[0].valor) : 0;
}

module.exports = async (req, res) => {
  if (!cronOk(req) && !authOk(req)) return send(res, 401, { error: 'nao_autorizado' });
  var hoje = new Date();
  try {
    var emp = await neonQuery("SELECT id FROM empresa WHERE codigo='SKAL'", []);
    if (!emp.length) return send(res, 200, { ok: true, msg: 'sem empresa SKAL', eventos_novos: 0 });
    var skal = emp[0].id;

    // 1) Normaliza a folha (conserta o 'insumo_líquido' do paste mobile, por código).
    var corrigidos = 0;
    var bad = await neonQuery("SELECT id FROM fato WHERE empresa_id=$1 AND metrica LIKE 'insumo%'", [skal]);
    if (bad.length) {
      // remove eventual folha_liquida já existente para não violar a unicidade, depois renomeia
      await neonQuery("DELETE FROM fato WHERE empresa_id=$1 AND metrica='folha_liquida'", [skal]);
      var up = await neonQuery("UPDATE fato SET metrica='folha_liquida' WHERE empresa_id=$1 AND metrica LIKE 'insumo%' RETURNING id", [skal]);
      corrigidos = up.length;
    }

    // 2) Lê os fatos-base
    var folha = await ultimoFato(skal, 'folha_liquida');
    var estaduais = await ultimoFato(skal, 'tributos_estaduais');
    var federais = await ultimoFato(skal, 'tributos_federais');
    var sInad = await neonQuery("SELECT data_ref AS data, valor FROM fato WHERE empresa_id=$1 AND metrica='inadimplencia' ORDER BY data_ref", [skal]);

    // 3) Detectores (código puro)
    var eventos = detectors.runAll({
      empresa: skal, hoje: hoje,
      folhaLiquidaMensal: folha, tributosEstaduais: estaduais, tributosFederais: federais,
      series: [{ metrica: 'inadimplencia', serie: sInad }]
    });

    // 4) Grava (idempotente via chave_dedupe)
    var emitidos = 0;
    for (var i = 0; i < eventos.length; i++) {
      var e = eventos[i];
      var r = await neonQuery(
        "INSERT INTO evento (tipo,origem,empresa_id,entidade_tipo,entidade_id,severidade,valor,contexto,evidencia,chave_dedupe,ts) " +
        "VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10, now()) " +
        "ON CONFLICT (empresa_id, tipo, chave_dedupe) WHERE chave_dedupe IS NOT NULL DO NOTHING RETURNING id",
        [e.tipo, e.origem, skal, e.entidade_tipo || null, e.entidade_id || null, e.severidade, e.valor,
         JSON.stringify(e.contexto), JSON.stringify(e.evidencia), e.chave_dedupe || null]);
      if (r.length) emitidos++;
    }
    return send(res, 200, { ok: true, folha_corrigida: corrigidos, eventos_detectados: eventos.length, eventos_novos: emitidos });
  } catch (e) {
    if (e.code === 'NO_DB') return send(res, 503, { error: 'db_offline' });
    return send(res, 500, { error: 'erro', detalhe: String(e).slice(0, 200) });
  }
};
