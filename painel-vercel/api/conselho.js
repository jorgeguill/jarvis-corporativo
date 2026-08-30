// GET /api/conselho?q=...  — CONSELHO DE AGENTES ESPECIALISTAS (multiagente real).
// Cada agente tem metodologia e dados reais (api/_especialistas). Dão posição em
// paralelo, um Challenger acha o furo (ex.: leitura ingênua da carteira), e o
// Coordenador sintetiza. Sobre os dados reais da SKAL; sem inventar número.
'use strict';
const { authOk } = require('./_auth');
const vigia = require('./_vigia');
const ESP = require('./_especialistas');

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
function withTimeout(ms){ var c=new AbortController(); setTimeout(function(){c.abort();},ms); return c; }

// model: 'gemini-2.5-flash' (rápido) ou 'gemini-2.5-pro' (mais fundo). Fallback: Anthropic opus.
async function ask(prompt, max, model) {
  var gk = process.env.GEMINI_API_KEY, ak = process.env.ANTHROPIC_API_KEY;
  if (gk) {
    try {
      var u = 'https://generativelanguage.googleapis.com/v1beta/models/'+(model||'gemini-2.5-flash')+':generateContent?key=' + encodeURIComponent(gk);
      var r = await fetch(u, { method:'POST', signal:withTimeout(45000).signal, headers:{'content-type':'application/json'},
        body: JSON.stringify({ contents:[{role:'user',parts:[{text:prompt}]}], generationConfig:{maxOutputTokens:max||520,temperature:0.55} }) });
      if (r.ok) { var j=await r.json(); var c=(j.candidates||[])[0]; var t=(((c||{}).content||{}).parts||[]).map(function(p){return p.text||'';}).join('').trim(); if(t) return t; }
    } catch(e){}
  }
  if (ak) {
    try {
      var r2 = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', signal:withTimeout(50000).signal,
        headers:{'x-api-key':ak,'anthropic-version':'2023-06-01','content-type':'application/json'},
        body: JSON.stringify({ model:'claude-opus-5', max_tokens:max||520, thinking:{type:'disabled'}, messages:[{role:'user',content:prompt}] }) });
      if (r2.ok) { var j2=await r2.json(); return (j2.content||[]).filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('').trim(); }
    } catch(e){}
  }
  return '';
}

module.exports = async (req, res) => {
  if (!authOk(req)) return send(res, 401, { error:'nao_autorizado' });
  var u = new URL(req.url,'http://x');
  var q = (u.searchParams.get('q')||'').slice(0,600).trim();
  if (!q) return send(res, 200, { pergunta:'', turnos:[], erro:'sem_pergunta' });

  var ctx = vigia.contexto('SKAL');
  var BASE = ESP.REGRAS + '\n\n=== SITUACAO REAL DA SKAL (dados do painel) ===\n' + ctx + '\n\n';
  try {
    // Rodada 1 — cada ESPECIALISTA dá sua posição fundamentada, EM PARALELO
    var posicoes = await Promise.all(ESP.AGENTES.map(function(a){
      var p = BASE + a.p + '\n\nPERGUNTA DA DIRETORIA: "'+q+'".\n' +
        'Responda com CONTEUDO, curto (3-5 frases): traga 1 CALCULO/numero real que sustente sua posicao, a INTERPRETACAO especialista e a RECOMENDACAO clara. Se a pergunta induz um erro de leitura comum na sua area, corrija-o. Fale so pela sua area, sem preambulo.';
      return ask(p, 480, 'gemini-2.5-flash').then(function(t){ return { id:a.id, agente:a.nome, ic:a.ic, cor:a.cor, texto:(t||'(sem resposta)') }; });
    }));
    var resumo = posicoes.map(function(p){ return '['+p.agente+'] '+p.texto; }).join('\n\n');

    // Rodada 2 — Challenger (modelo mais fundo) acha o furo
    var chP = BASE + ESP.CHALLENGER + '\n\nPERGUNTA: "'+q+'".\nPOSICOES DOS COLEGAS:\n'+resumo+'\n\nAponte o furo com numero, 3-5 frases. Nao suavize.';
    var challenger = await ask(chP, 480, 'gemini-2.5-pro');

    // Rodada 3 — Coordenador sintetiza (modelo mais fundo, JSON)
    var coP = BASE + ESP.COORDENADOR + '\n\nPERGUNTA: "'+q+'".\nDEBATE:\n'+resumo+'\n\nCONTRADITORIO: '+challenger+'\n\nSintetize agora.';
    var coTxt = await ask(coP, 800, 'gemini-2.5-pro');
    var sintese=null; try { var m=coTxt.match(/\{[\s\S]*\}/); if(m) sintese=JSON.parse(m[0]); } catch(e){}

    var turnos = posicoes.concat([{ id:'risco', agente:'Auditoria · Contraditório', ic:'⚔️', cor:'#c77dff', texto:(challenger||'(sem resposta)') }]);
    return send(res, 200, { pergunta:q, turnos:turnos, sintese:sintese });
  } catch (e) {
    return send(res, 200, { pergunta:q, turnos:[], erro:String(e).slice(0,160) });
  }
};
