// GET /api/aicheck — termômetro da IA do Conselho. Diz SE as chaves existem e
// QUAL modelo Gemini responde (testa a lista de candidatos do _ai). NAO expoe
// nenhuma chave nem valor sensivel — so booleanos, modelo, status e trecho do erro.
'use strict';
var AI = require('./_ai');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  var out = { ts:new Date().toISOString(),
    tem_chave_gemini: !!process.env.GEMINI_API_KEY,
    tem_chave_anthropic: !!process.env.ANTHROPIC_API_KEY,
    modelos_flash: AI.FLASH, modelos_pro: AI.PRO };
  try {
    var g = await AI.gemini('Responda apenas: OK', 16, 'flash', 12000);
    var gp = await AI.gemini('Responda apenas: OK', 16, 'pro', 12000);
    var a = await AI.anthropic('Responda apenas: OK', 16, 15000);
    out.gemini_flash = g.t ? { ok:true, modelo_que_funcionou:g.model } : { ok:false, motivo:g.why };
    out.gemini_pro   = gp.t ? { ok:true, modelo_que_funcionou:gp.model } : { ok:false, motivo:gp.why };
    out.anthropic    = a.t ? { ok:true } : { ok:false, motivo:a.why };
    out.veredito = (g.t || gp.t || a.t)
      ? ('IA OK — Conselho tem como responder (modelo: '+(g.model||gp.model||'anthropic')+')')
      : 'IA NAO responde — nenhum modelo/provedor disponivel';
    res.statusCode = 200;
  } catch(e){ out.erro = String(e).slice(0,160); res.statusCode = 200; }
  return res.end(JSON.stringify(out, null, 2));
};
