// _ai.js — camada única de IA do RADAR. Um SÓ lugar para o nome do modelo.
// O Google aposenta nomes de modelo (ex.: gemini-2.5-flash virou 404 para chaves
// novas); por isso aqui vai uma LISTA de candidatos e usamos o primeiro que
// responde, memorizando-o. Fallback final: Anthropic (se a chave existir).
// Sobrescrevível por env: GEMINI_MODELS_FLASH / GEMINI_MODELS_PRO (CSV).
'use strict';

var FLASH = (process.env.GEMINI_MODELS_FLASH ||
  'gemini-flash-latest,gemini-2.0-flash,gemini-2.5-flash,gemini-2.5-flash-lite,gemini-flash-lite-latest'
).split(',').map(function(s){return s.trim();}).filter(Boolean);

var PRO = (process.env.GEMINI_MODELS_PRO ||
  'gemini-pro-latest,gemini-2.5-pro,gemini-flash-latest,gemini-2.0-flash'
).split(',').map(function(s){return s.trim();}).filter(Boolean);

// Memória do modelo que funcionou (evita reincidir nos 404 a cada chamada).
var cache = { flash:null, pro:null };

function withTimeout(ms){ var c=new AbortController(); setTimeout(function(){c.abort();},ms); return c; }

// Uma tentativa contra UM modelo Gemini. Retorna {ok, status, text}.
async function geminiOnce(model, prompt, max, timeoutMs){
  var gk = process.env.GEMINI_API_KEY;
  var u = 'https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent?key='+encodeURIComponent(gk);
  var r = await fetch(u, { method:'POST', signal:withTimeout(timeoutMs||30000).signal, headers:{'content-type':'application/json'},
    body: JSON.stringify({ contents:[{role:'user',parts:[{text:prompt}]}], generationConfig:{maxOutputTokens:max||520,temperature:0.55} }) });
  var body = await r.text();
  if (r.ok) { var j={}; try{ j=JSON.parse(body); }catch(e){} var c=(j.candidates||[])[0];
    var t=(((c||{}).content||{}).parts||[]).map(function(p){return p.text||'';}).join('').trim();
    return { ok:!!t, status:r.status, text:t }; }
  return { ok:false, status:r.status, text:'', body:body };
}

// Gemini com fallback de modelo. tier: 'flash' | 'pro'. Retorna {t, model, why}.
async function gemini(prompt, max, tier, timeoutMs){
  if (!process.env.GEMINI_API_KEY) return { t:'', model:'', why:'sem GEMINI_API_KEY' };
  var base = (tier==='pro') ? PRO : FLASH;
  var list = cache[tier] ? [cache[tier]].concat(base.filter(function(m){return m!==cache[tier];})) : base.slice();
  var why = '';
  for (var i=0;i<list.length;i++){
    var m = list[i];
    try {
      var r = await geminiOnce(m, prompt, max, timeoutMs);
      if (r.ok) { cache[tier] = m; return { t:r.t || r.text, model:m, why:'' }; }
      // 404 (modelo aposentado), 503 (sobrecarga) e 429 (limite) sao ESPECIFICOS
      // do modelo/momento -> vale tentar OUTRO modelo da lista antes de desistir.
      if (r.status === 404 || r.status === 503 || r.status === 429) {
        why = 'gemini HTTP '+r.status+(r.status===429?' (limite de cota)':r.status===503?' (sobrecarga)':' (modelo indisponivel)');
        if (cache[tier] === m) cache[tier] = null; // o cache falhou; nao insista nele
        continue;
      }
      why = 'gemini HTTP '+r.status; break; // 401/403/400: trocar modelo nao ajuda
    } catch(e){ why = 'gemini '+String(e&&e.name||e).slice(0,40); break; }
  }
  return { t:'', model:'', why:why||'gemini sem resposta' };
}

// Fallback Anthropic ciente do tier: 'flash' (12 agentes) usa modelo economico;
// 'pro' (Challenger/Coordenador) usa modelo fundo. Sobrescrevivel por env.
function anthropicModelFor(tier){
  if (tier === 'pro') return process.env.ANTHROPIC_MODEL_PRO || 'claude-opus-5';
  return process.env.ANTHROPIC_MODEL_FLASH || 'claude-sonnet-5';
}
async function anthropic(prompt, max, timeoutMs, tier){
  var ak = process.env.ANTHROPIC_API_KEY;
  if (!ak) return { t:'', why:'sem ANTHROPIC_API_KEY' };
  var model = process.env.ANTHROPIC_MODEL || anthropicModelFor(tier);
  try {
    var r = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', signal:withTimeout(timeoutMs||40000).signal,
      headers:{'x-api-key':ak,'anthropic-version':'2023-06-01','content-type':'application/json'},
      body: JSON.stringify({ model: model, max_tokens:max||520, messages:[{role:'user',content:prompt}] }) });
    var body = await r.text();
    if (r.ok) { var j={}; try{ j=JSON.parse(body); }catch(e){}
      var t=(j.content||[]).filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('').trim();
      if (t) return { t:t, model:model, why:'' }; return { t:'', why:'anthropic vazio' }; }
    return { t:'', why:'anthropic HTTP '+r.status };
  } catch(e){ return { t:'', why:'anthropic '+String(e&&e.name||e).slice(0,40) }; }
}

// API principal: tenta Gemini (com fallback de modelo) e cai para Anthropic.
// Retorna {t, model, why}. t vazio = falhou (why explica).
async function ask(prompt, max, tier, timeoutMs){
  var g = await gemini(prompt, max, tier, timeoutMs);
  if (g.t) return g;
  var a = await anthropic(prompt, max, timeoutMs, tier);
  if (a.t) return { t:a.t, model:a.model||'anthropic', why:'' };
  return { t:'', model:'', why:(g.why||'') + (a.why ? ' | '+a.why : '') };
}

module.exports = { ask:ask, gemini:gemini, anthropic:anthropic, geminiOnce:geminiOnce, FLASH:FLASH, PRO:PRO, _cache:cache };
