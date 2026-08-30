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
function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }

// Uma tentativa. Retorna {t, why}: t = texto (pode ser ''), why = motivo da falha.
async function tryAsk(prompt, max, model) {
  var gk = process.env.GEMINI_API_KEY, ak = process.env.ANTHROPIC_API_KEY;
  var why = '';
  if (gk) {
    try {
      var u = 'https://generativelanguage.googleapis.com/v1beta/models/'+(model||'gemini-2.5-flash')+':generateContent?key=' + encodeURIComponent(gk);
      var r = await fetch(u, { method:'POST', signal:withTimeout(30000).signal, headers:{'content-type':'application/json'},
        body: JSON.stringify({ contents:[{role:'user',parts:[{text:prompt}]}], generationConfig:{maxOutputTokens:max||520,temperature:0.55} }) });
      if (r.ok) { var j=await r.json(); var c=(j.candidates||[])[0]; var t=(((c||{}).content||{}).parts||[]).map(function(p){return p.text||'';}).join('').trim(); if(t) return { t:t, why:'' }; why='gemini vazio'; }
      else { why='gemini HTTP '+r.status; }
    } catch(e){ why='gemini '+String(e&&e.name||e).slice(0,40); }
  } else { why='sem GEMINI_API_KEY'; }
  if (ak) {
    try {
      var r2 = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', signal:withTimeout(35000).signal,
        headers:{'x-api-key':ak,'anthropic-version':'2023-06-01','content-type':'application/json'},
        body: JSON.stringify({ model:'claude-opus-5', max_tokens:max||520, thinking:{type:'disabled'}, messages:[{role:'user',content:prompt}] }) });
      if (r2.ok) { var j2=await r2.json(); var ta=(j2.content||[]).filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('').trim(); if(ta) return { t:ta, why:'' }; why+=' | anthropic vazio'; }
      else { why+=' | anthropic HTTP '+r2.status; }
    } catch(e){ why+=' | anthropic '+String(e&&e.name||e).slice(0,40); }
  } else if(!gk){ why='sem chave de IA (GEMINI/ANTHROPIC)'; }
  return { t:'', why:why||'sem resposta' };
}

// Com retry (1 reintento com backoff) — protege contra limite de taxa (429) em rajada.
async function askEx(prompt, max, model) {
  var a = await tryAsk(prompt, max, model);
  if (a.t) return a;
  await sleep(900);
  var b = await tryAsk(prompt, max, model);
  return b.t ? b : a;
}
async function ask(prompt, max, model){ var r = await askEx(prompt, max, model); return r.t; }

// Executa tarefas em LOTES (concorrencia limitada) para nao estourar o limite da API.
async function emLotes(itens, tamLote, fn) {
  var out = [];
  for (var i=0; i<itens.length; i+=tamLote) {
    var lote = itens.slice(i, i+tamLote);
    var res = await Promise.all(lote.map(fn));
    out = out.concat(res);
  }
  return out;
}

module.exports = async (req, res) => {
  if (!authOk(req)) return send(res, 401, { error:'nao_autorizado' });
  var u = new URL(req.url,'http://x');
  var q = (u.searchParams.get('q')||'').slice(0,600).trim();
  if (!q) return send(res, 200, { pergunta:'', turnos:[], erro:'sem_pergunta' });

  var ctx = vigia.contexto('SKAL');
  var BASE = ESP.CABECALHO + '\n\n=== SITUACAO REAL DA SKAL (dados do painel) ===\n' + ctx + '\n\n';
  try {
    // Rodada 1 — cada ESPECIALISTA dá sua posição fundamentada, EM LOTES de 3
    // (concorrencia limitada evita estourar o limite de taxa da API e voltar vazio).
    var posicoes = await emLotes(ESP.AGENTES, 3, function(a){
      var p = BASE + a.p + '\n\nPERGUNTA DA DIRETORIA: "'+q+'".\n' +
        'Responda com CONTEUDO de nivel internacional, curto (4-6 frases): traga 1 CALCULO/numero real, use um METODO quando projetar (metodo+premissa+cenario), LIGUE ao driver de mercado/macro quando relevante (Selic, cambio, credito, sazonalidade), e termine com RECOMENDACAO clara. Corrija erros de leitura comuns na sua area. Fale so pela sua area, sem preambulo.';
      return askEx(p, 560, 'gemini-2.5-flash').then(function(r){
        return { id:a.id, agente:a.nome, ic:a.ic, cor:a.cor, texto:(r.t || ('⚠️ IA nao respondeu ('+r.why+')')), _ok:!!r.t };
      });
    });
    var okN = posicoes.filter(function(p){ return p._ok; }).length;
    // Se NINGUEM respondeu, e falha de IA (chave/limite) — nao adianta seguir para as sinteses.
    if (okN === 0) {
      var motivo = (posicoes[0] && posicoes[0].texto) || 'IA indisponivel';
      posicoes.forEach(function(p){ delete p._ok; });
      return send(res, 200, { pergunta:q, turnos:posicoes,
        sintese:{ consenso:'Conselho nao pode deliberar agora.', divergencia:'', projecao:'',
          recomendacao:'A IA nao respondeu a nenhum agente. Motivo tecnico: '+motivo+'. Verifique /api/aicheck.',
          confianca:'baixa — falha tecnica, nao de conteudo', acao:'Abrir /api/aicheck para ver a causa (chave ou limite de taxa).' },
        diag:'ia_indisponivel: '+motivo });
    }
    posicoes.forEach(function(p){ delete p._ok; });
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
