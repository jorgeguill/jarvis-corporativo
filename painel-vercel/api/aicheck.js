// GET /api/aicheck — termômetro da IA do Conselho. Diz SE as chaves existem e SE
// cada provedor responde a uma chamada minima, com o codigo/erro quando falha.
// NAO expoe nenhuma chave nem valor sensivel — so booleanos, status e um trecho
// curto do erro. Serve para diagnosticar "todos os agentes deram (sem resposta)".
'use strict';

function withTimeout(ms){ var c=new AbortController(); setTimeout(function(){c.abort();},ms); return c; }

// Testa o Gemini com o MESMO modelo que o Conselho usa.
async function testGemini(model){
  var gk = process.env.GEMINI_API_KEY;
  if (!gk) return { key:false, ok:false, motivo:'sem GEMINI_API_KEY' };
  try {
    var u = 'https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent?key='+encodeURIComponent(gk);
    var r = await fetch(u, { method:'POST', signal:withTimeout(12000).signal, headers:{'content-type':'application/json'},
      body: JSON.stringify({ contents:[{role:'user',parts:[{text:'Responda apenas: OK'}]}], generationConfig:{maxOutputTokens:16,temperature:0} }) });
    var body = await r.text();
    if (r.ok) {
      var j={}; try{ j=JSON.parse(body); }catch(e){}
      var c=(j.candidates||[])[0]; var t=(((c||{}).content||{}).parts||[]).map(function(p){return p.text||'';}).join('').trim();
      return { key:true, ok:!!t, status:r.status, amostra:t.slice(0,40) };
    }
    return { key:true, ok:false, status:r.status, motivo:body.slice(0,160) };
  } catch(e){ return { key:true, ok:false, motivo:String(e).slice(0,120) }; }
}

async function testAnthropic(model){
  var ak = process.env.ANTHROPIC_API_KEY;
  if (!ak) return { key:false, ok:false, motivo:'sem ANTHROPIC_API_KEY' };
  try {
    var r = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', signal:withTimeout(15000).signal,
      headers:{'x-api-key':ak,'anthropic-version':'2023-06-01','content-type':'application/json'},
      body: JSON.stringify({ model:model, max_tokens:16, messages:[{role:'user',content:'Responda apenas: OK'}] }) });
    var body = await r.text();
    if (r.ok) {
      var j={}; try{ j=JSON.parse(body); }catch(e){}
      var t=(j.content||[]).filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('').trim();
      return { key:true, ok:!!t, status:r.status, amostra:t.slice(0,40) };
    }
    return { key:true, ok:false, status:r.status, motivo:body.slice(0,160) };
  } catch(e){ return { key:true, ok:false, motivo:String(e).slice(0,120) }; }
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  var out = { ts:new Date().toISOString() };
  try {
    var g = await testGemini('gemini-2.5-flash');
    var gp = g.ok ? { key:true, ok:true, pulado:true } : await testGemini('gemini-2.5-pro');
    var a = await testAnthropic('claude-opus-5');
    out.gemini_flash = g;
    out.gemini_pro = gp;
    out.anthropic = a;
    out.veredito = (g.ok || a.ok)
      ? 'IA OK — o Conselho tem como responder'
      : 'IA NAO responde — por isso os agentes voltam vazios';
    res.statusCode = 200;
  } catch(e){ out.erro = String(e).slice(0,160); res.statusCode = 200; }
  return res.end(JSON.stringify(out, null, 2));
};
