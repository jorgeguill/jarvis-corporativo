// Vigia inteligente: lê TODA a situação já implantada no painel (KPIs, todos os
// cards, hoje, forno, notas) e usa a IA como analista sênior para levantar os
// achados que importam — riscos, desembolsos futuros, anomalias, oportunidades e
// situações cruzadas. Regra dura: nunca inventar número fora do contexto.
'use strict';
const DATA = require('./data');

// Monta um retrato COMPLETO da empresa a partir dos dados já implantados.
function contexto(coKey) {
  var p = DATA.buildData();
  var d = (p.DATA && p.DATA[coKey]) || {};
  var L = [];
  L.push('EMPRESA: ' + (d.nome || coKey));
  if (d.kpis && d.kpis.length) L.push('KPIs: ' + d.kpis.map(function (k) { return k.l + ' = ' + k.v; }).join(' | '));
  if (d.alerta && d.alerta.tit) L.push('ALERTA PRINCIPAL: ' + d.alerta.tit + (d.alerta.txt ? ' — ' + d.alerta.txt : ''));
  if (d.eventos && d.eventos.length) {
    L.push('CARDS / SITUACOES ATIVAS:');
    d.eventos.forEach(function (e) { if (e && e.tt) L.push('- [' + (e.tp || e.t || '') + '] ' + e.tt); });
  }
  if (d.entradas && d.entradas.q) L.push('ENTRADAS DO DIA: ' + d.entradas.q);
  if (d.hoje && d.hoje.det) {
    var det = d.hoje.det;
    ['decisoes', 'riscos', 'pendencias', 'oportunidades'].forEach(function (k) {
      if (det[k]) L.push(k.toUpperCase() + ': ' + String(det[k]).replace(/\n/g, ' '));
    });
  }
  if (d.nota) L.push('NOTA: ' + d.nota);
  return L.join('\n');
}

async function askLLM(prompt) {
  var ak = process.env.ANTHROPIC_API_KEY, gk = process.env.GEMINI_API_KEY;
  if (ak) {
    try {
      var r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ak, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-opus-5', max_tokens: 2500, thinking: { type: 'disabled' }, messages: [{ role: 'user', content: prompt }] })
      });
      if (r.ok) { var j = await r.json(); return (j.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join(''); }
    } catch (e) { }
  }
  if (gk) {
    try {
      var u = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(gk);
      var r2 = await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2500, temperature: 0.4 } }) });
      if (r2.ok) { var j2 = await r2.json(); var c = (j2.candidates || [])[0]; return (((c || {}).content || {}).parts || []).map(function (p) { return p.text || ''; }).join(''); }
    } catch (e) { }
  }
  return '';
}

function parse(txt) {
  if (!txt) return [];
  var m = txt.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try { var a = JSON.parse(m[0]); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}

// Roda o scan de uma empresa e devolve a lista de achados (objetos).
async function scan(coKey) {
  var ctx = contexto(coKey || 'SKAL');
  var prompt =
    'Voce e o VIGIA do R.A.D.A.R., analista senior da diretoria. Abaixo esta TODA a situacao atual da empresa, com dados reais. ' +
    'Sua tarefa: revisar o conjunto inteiro e listar os pontos que a diretoria precisa ver HOJE — riscos, desembolsos futuros, anomalias, ' +
    'oportunidades e SITUACOES QUE SO APARECEM CRUZANDO AREAS (ex.: cobranca x caixa x tributos). Seja perspicaz, especifico e use os NUMEROS ' +
    'REAIS do contexto. NUNCA invente numero, data ou fato que nao esteja nos dados abaixo; se algo for incerto, diga que precisa confirmar. ' +
    'Responda SOMENTE um array JSON valido, sem texto fora dele, no formato: ' +
    '[{"titulo":"curto e direto","area":"Financeiro|Cobranca|Fiscal|Producao|Permutas|RH|Comercial|Estrategia","severidade":1-5,' +
    '"msg":"1-2 frases com o numero real e o porque importa","acao":"a acao recomendada"}]. ' +
    'No maximo 10 itens, os mais importantes (maior severidade) primeiro. severidade 5 = critico, 3 = atencao, 1 = informativo.\n\n' +
    '=== SITUACAO ATUAL ===\n' + ctx;
  var txt = await askLLM(prompt);
  return parse(txt).slice(0, 10);
}

module.exports = { scan: scan, contexto: contexto };
