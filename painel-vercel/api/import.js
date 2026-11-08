// POST /api/import — grava um RETRATO no Neon (página /import). Autenticado (authOk).
// Idempotente: re-subir o mesmo tipo/data SUBSTITUI. Escreve em DOIS lugares:
//   (1) `fato` — os KPIs monetários (metrica canônica, unidade_med='BRL', reais cheios)
//       que o painel sobrepõe via overlayFromDB quando DATA_SOURCE='neon'.
//   (2) `retrato` — o retrato completo (aging/cronograma/bancos/devedores) em jsonb.
// NUNCA derruba nada: valida a entrada e devolve erro claro; não expõe segredo.
'use strict';
var auth = require('./_auth');

// metricas canônicas aceitas por tipo (metrica -> grava em fato com unidade_med='BRL')
var TIPOS = {
  inadimplencia: ['inadimplencia'],
  caixa:         ['caixa'],
  carteira:      ['a_receber','a_pagar'],
  folha:         ['folha_liquida']
};

async function readBody(req){
  if (req.body) { try { return typeof req.body==='string'?JSON.parse(req.body):req.body; } catch(e){ return {}; } }
  return await new Promise(function(resolve){ var d=''; req.on('data',function(c){ d+=c; if(d.length>2e6) req.destroy(); }); req.on('end',function(){ try{ resolve(JSON.parse(d||'{}')); }catch(e){ resolve({}); } }); });
}
function numOf(v){ var n = Number(v); return isFinite(n) ? n : null; }

async function empresaId(neon, codigo){
  await neon.neonQuery("INSERT INTO empresa(codigo,nome) VALUES($1,$1) ON CONFLICT (codigo) DO NOTHING", [codigo]);
  var r = await neon.neonQuery("SELECT id FROM empresa WHERE codigo=$1", [codigo]);
  return r && r[0] ? r[0].id : null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-radar-auth');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(JSON.stringify({ ok:false, erro:'metodo' })); }
  if (!auth.authOk(req)) { res.statusCode = 401; return res.end(JSON.stringify({ ok:false, auth:true, erro:'Faça login para importar.' })); }
  if (!process.env.DATABASE_URL) { res.statusCode = 200; return res.end(JSON.stringify({ ok:false, erro:'DATABASE_URL não configurado na Vercel — sem banco para gravar.' })); }

  var body = await readBody(req);
  var empresa = String(body.empresa || '').trim().toUpperCase();
  var tipo = String(body.tipo || '').trim();
  var data_ref = String(body.data_ref || '').trim();
  var payload = (body.payload && typeof body.payload === 'object') ? body.payload : {};
  var fonte = String(body.fonte || '').slice(0, 200);
  var kpis = Array.isArray(body.kpis) ? body.kpis : [];

  if (!empresa) return bad(res, 'Informe a empresa (ex.: SKAL).');
  if (!TIPOS[tipo]) return bad(res, 'Tipo inválido. Use: ' + Object.keys(TIPOS).join(', ') + '.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data_ref)) return bad(res, 'Data do retrato inválida (use AAAA-MM-DD).');
  // valida os KPIs: metrica permitida para o tipo + valor numérico
  var limpos = [];
  for (var i=0;i<kpis.length;i++){
    var m = String(kpis[i] && kpis[i].metrica || '').trim();
    var v = numOf(kpis[i] && kpis[i].valor);
    if (TIPOS[tipo].indexOf(m) < 0) return bad(res, 'Métrica "'+m+'" não pertence ao tipo "'+tipo+'".');
    if (v === null) return bad(res, 'Valor de "'+m+'" não é numérico.');
    limpos.push({ metrica:m, valor:v, detalhe:(kpis[i].detalhe && typeof kpis[i].detalhe==='object')?kpis[i].detalhe:{} });
  }
  if (!limpos.length) return bad(res, 'Nenhum valor para gravar.');

  try {
    var neon = require('./_neon');
    var eid = await empresaId(neon, empresa);
    if (!eid) return bad(res, 'Não consegui resolver a empresa no banco.');

    // (1) fato — um por KPI (unidade_id NULL = nível empresa). UPSERT idempotente.
    for (var j=0;j<limpos.length;j++){
      await neon.neonQuery(
        "INSERT INTO fato (empresa_id, metrica, valor, unidade_med, data_ref, detalhe) " +
        "VALUES ($1,$2,$3,'BRL',$4,$5::jsonb) " +
        "ON CONFLICT (empresa_id, unidade_id, metrica, data_ref) " +
        "DO UPDATE SET valor=EXCLUDED.valor, detalhe=EXCLUDED.detalhe, created_at=now()",
        [eid, limpos[j].metrica, limpos[j].valor, data_ref, JSON.stringify(limpos[j].detalhe)]
      );
    }
    // (2) retrato completo
    await neon.neonQuery(
      "INSERT INTO retrato (empresa_id, tipo, data_ref, payload, fonte) " +
      "VALUES ($1,$2,$3,$4::jsonb,$5) " +
      "ON CONFLICT (empresa_id, tipo, data_ref) " +
      "DO UPDATE SET payload=EXCLUDED.payload, fonte=EXCLUDED.fonte, created_at=now()",
      [eid, tipo, data_ref, JSON.stringify(payload), fonte]
    );
    // (3) auditoria (best-effort, nunca falha a importação)
    try {
      await neon.neonQuery(
        "INSERT INTO ingestao (empresa_id, arquivo, status, linhas, detalhe) VALUES ($1,$2,'ok',$3,$4::jsonb)",
        [eid, fonte || (tipo+' '+data_ref), limpos.length, JSON.stringify({ tipo:tipo, data_ref:data_ref })]
      );
    } catch(e){}

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok:true, empresa:empresa, tipo:tipo, data_ref:data_ref, gravados:limpos.length,
      msg:'Gravado no Neon. '+limpos.length+' KPI(s) + retrato de '+tipo+' ('+data_ref+').' }));
  } catch (e) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok:false, erro:'Falha ao gravar no Neon: ' + String(e).slice(0,160) }));
  }
};

function bad(res, msg){ res.statusCode = 200; return res.end(JSON.stringify({ ok:false, erro:msg })); }
