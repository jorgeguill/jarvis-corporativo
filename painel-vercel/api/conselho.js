// GET /api/conselho?q=...  — CONSELHO DE AGENTES (multiagente real).
// Vários agentes da SKAL debatem uma pergunta em cima dos dados reais: cada um dá
// sua posição (em paralelo), um Challenger contradiz e acha o furo, e o Coordenador
// sintetiza (consenso / divergência / recomendação). É a "empresa que pensa".
'use strict';
const { authOk } = require('./_auth');
const vigia = require('./_vigia');

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
function withTimeout(ms){ var c=new AbortController(); setTimeout(function(){c.abort();},ms); return c; }

async function ask(prompt, max) {
  var gk = process.env.GEMINI_API_KEY, ak = process.env.ANTHROPIC_API_KEY;
  if (gk) {
    try {
      var u = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(gk);
      var r = await fetch(u, { method:'POST', signal:withTimeout(38000).signal, headers:{'content-type':'application/json'},
        body: JSON.stringify({ contents:[{role:'user',parts:[{text:prompt}]}], generationConfig:{maxOutputTokens:max||500,temperature:0.6} }) });
      if (r.ok) { var j=await r.json(); var c=(j.candidates||[])[0]; var t=(((c||{}).content||{}).parts||[]).map(function(p){return p.text||'';}).join('').trim(); if(t) return t; }
    } catch(e){}
  }
  if (ak) {
    try {
      var r2 = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', signal:withTimeout(48000).signal,
        headers:{'x-api-key':ak,'anthropic-version':'2023-06-01','content-type':'application/json'},
        body: JSON.stringify({ model:'claude-opus-5', max_tokens:max||500, thinking:{type:'disabled'}, messages:[{role:'user',content:prompt}] }) });
      if (r2.ok) { var j2=await r2.json(); return (j2.content||[]).filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('').trim(); }
    } catch(e){}
  }
  return '';
}

var AGENTES = [
  { id:'fin',  nome:'Financeiro', ic:'💰', cor:'#2fd98a', lente:'caixa, fluxo, capital de giro, contas a pagar e a receber' },
  { id:'cob',  nome:'Cobrança',   ic:'📮', cor:'#ff5468', lente:'inadimplência, aging, recuperação de recebíveis, o +90 travado' },
  { id:'fis',  nome:'Fiscal',     ic:'📊', cor:'#5bb2ff', lente:'tributos, incentivo ICMS, carga fiscal e prazos' },
  { id:'prod', nome:'Produção',   ic:'🏭', cor:'#ffb23e', lente:'forno, areia seca, custo por saco, gargalos operacionais' }
];

function base(ctx){ return 'Voce e um conselheiro senior da diretoria da SKAL Engenharia. Use os NUMEROS REAIS abaixo; NUNCA invente numero, data ou fato fora deles. Seja direto e curto.\n\n=== SITUACAO REAL DA SKAL ===\n'+ctx+'\n'; }

module.exports = async (req, res) => {
  if (!authOk(req)) return send(res, 401, { error:'nao_autorizado' });
  var u = new URL(req.url,'http://x');
  var q = (u.searchParams.get('q')||'').slice(0,600).trim();
  if (!q) return send(res, 200, { pergunta:'', turnos:[], erro:'sem_pergunta' });
  var ctx = vigia.contexto('SKAL');
  var B = base(ctx);
  try {
    // Rodada 1 — cada agente dá sua posicao, EM PARALELO
    var posicoes = await Promise.all(AGENTES.map(function(a){
      var p = B + 'Voce e o agente '+a.nome+' (lente: '+a.lente+'). PERGUNTA DA DIRETORIA: "'+q+'". '+
        'De a SUA posicao em 2-3 frases, com pelo menos um numero real, deixando clara sua RECOMENDACAO. Fale so pela sua area. Sem preambulo.';
      return ask(p, 350).then(function(t){ return { id:a.id, agente:a.nome, ic:a.ic, cor:a.cor, texto:t||'(sem resposta)' }; });
    }));

    var resumo = posicoes.map(function(p){ return p.agente+': '+p.texto; }).join('\n');

    // Rodada 2 — Challenger contradiz e acha o furo
    var chP = B + 'Voce e o agente RISCO/CONTRADITORIO. As posicoes dos colegas foram:\n'+resumo+'\n\n'+
      'PERGUNTA: "'+q+'". Sua funcao e DISCORDAR de forma util: aponte o furo, a premissa fragil, o risco ou o efeito de 2a ordem que os outros nao viram. Cite pelo menos um numero. 2-3 frases, sem suavizar.';
    var challenger = await ask(chP, 350);

    // Rodada 3 — Coordenador sintetiza
    var coP = B + 'Voce e o COORDENADOR. Debate dos agentes:\n'+resumo+'\nRISCO/CONTRADITORIO: '+challenger+'\n\n'+
      'PERGUNTA: "'+q+'". Sintetize para a diretoria. Responda SOMENTE um JSON valido: '+
      '{"consenso":"...","divergencia":"...","recomendacao":"1) ... 2) ... 3) ...","confianca":"alta|media|baixa e por que","acao":"a proxima acao concreta"}. Use numeros reais.';
    var coTxt = await ask(coP, 700);
    var sintese = null; try { var m=coTxt.match(/\{[\s\S]*\}/); if(m) sintese=JSON.parse(m[0]); } catch(e){}

    var turnos = posicoes.concat([{ id:'risco', agente:'Risco · Contraditório', ic:'⚔️', cor:'#c77dff', texto:challenger||'(sem resposta)' }]);
    return send(res, 200, { pergunta:q, turnos:turnos, sintese:sintese });
  } catch (e) {
    return send(res, 200, { pergunta:q, turnos:[], erro:String(e).slice(0,160) });
  }
};
