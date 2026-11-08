// GET /api/fornocheck — termômetro da ponte com o Painel do Forno.
// Lê o Firebase do Forno ao vivo e devolve os KPIs calculados (produção seca,
// consumo específico, preço e custo da secagem) OU o motivo da falha. Público,
// sem segredo e sem connection string — serve para validar a interligação.
'use strict';

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  try {
    var forno = require('./_forno');
    var s = await forno.snapshot();
    res.statusCode = 200;
    return res.end(JSON.stringify(s, null, 2));
  } catch (e) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: false, fonte: 'Painel do Forno (Firebase)', msg: String(e && e.message || e).slice(0, 160) }));
  }
};
