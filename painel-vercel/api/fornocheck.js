// GET /api/fornocheck — termômetro da ponte com o Painel do Forno.
// Sem parâmetro: devolve o snapshot() (KPIs calculados) ou o motivo da falha.
// ?detalhe=YYYY-MM-DD (ou ?audit=1): modo AUDITORIA — lista os recebimentos registro
// a registro desde a data, marcando os suspeitos (gás lançado como óleo) e a contagem
// de turnos por combustível por mês. Público, sem segredo e sem connection string.
'use strict';

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  try {
    var forno = require('./_forno');
    var u = new URL(req.url, 'http://x');
    var det = u.searchParams.get('detalhe');
    var audit = u.searchParams.get('audit');
    var liveQ = u.searchParams.get('live');
    var out = liveQ ? await forno.live()
            : (det || audit) ? await forno.auditoria(det || undefined)
            : await forno.snapshot();
    res.statusCode = 200;
    return res.end(JSON.stringify(out, null, 2));
  } catch (e) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: false, fonte: 'Painel do Forno (Firebase)', msg: String(e && e.message || e).slice(0, 160) }));
  }
};
