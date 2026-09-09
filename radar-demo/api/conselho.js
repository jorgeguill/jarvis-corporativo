// GET /api/conselho?q=...  — CONSELHO DE AGENTES ESPECIALISTAS (multiagente real).
// Cada agente tem metodologia e dados reais (api/_especialistas). Dão posição em
// paralelo, um Challenger acha o furo (ex.: leitura ingênua da carteira), e o
// Coordenador sintetiza. Sobre os dados reais da SKAL; sem inventar número.
'use strict';
const { authOk } = require('./_auth');
const vigia = require('./_vigia');
const ESP = require('./_especialistas');
const AI = require('./_ai');

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }

// Chamada de IA via camada única (_ai): Gemini com fallback de MODELO (resolve o
// 404 de nomes aposentados) e, se houver chave, Anthropic. tier: 'flash' | 'pro'.
// Retry: 1 reintento com backoff — protege contra limite de taxa (429) em rajada.
async function askEx(prompt, max, tier) {
  var a = await AI.ask(prompt, max, tier, 30000);
  if (a.t) return a;
  await sleep(900);
  var b = await AI.ask(prompt, max, tier, 30000);
  return b.t ? b : a;
}
async function ask(prompt, max, tier){ var r = await askEx(prompt, max, tier); return r.t; }

// Divide uma lista em pedaços de tamanho n.
function pedacos(arr, n) {
  var g = []; for (var i=0; i<arr.length; i+=n) g.push(arr.slice(i, i+n)); return g;
}

module.exports = async (req, res) => {
  if (!authOk(req)) return send(res, 401, { error:'nao_autorizado' });
  var u = new URL(req.url,'http://x');
  var q = (u.searchParams.get('q')||'').slice(0,600).trim();
  if (!q) return send(res, 200, { pergunta:'', turnos:[], erro:'sem_pergunta' });

  var ctx = vigia.contexto('SKAL');
  var BASE = ESP.CABECALHO + '\n\n=== SITUACAO REAL DA SKAL (dados do painel) ===\n' + ctx + '\n\n';

  // Um PAINEL de várias cadeiras numa ÚNICA chamada (economiza chamadas e cota do
  // tier gratuito: em vez de 1 chamada por agente, poucas chamadas por convocação).
  async function painel(grupo) {
    var cadeiras = grupo.map(function(a){ return '### CADEIRA '+a.id+' — '+a.nome+'\n'+a.p; }).join('\n\n');
    var p = BASE +
      'Voce e um PAINEL de '+grupo.length+' conselheiros especialistas. Para CADA cadeira abaixo produza a analise DELA — cada uma FICA NA SUA CADEIRA (metrica e numero PROPRIOS; sem repetir o macro nem numeros de outra cadeira). Cada texto: 4-5 frases, com CALCULO/numero real do painel (ou DADO A CONFIRMAR), leitura e RECOMENDACAO em R$.\n\n' +
      cadeiras + '\n\nPERGUNTA DA DIRETORIA: "'+q+'".\n' +
      'Responda SOMENTE um JSON array valido, um objeto por cadeira, NA ORDEM dada, assim: [{"id":"'+grupo[0].id+'","texto":"..."}, ...]. Nada fora do JSON.';
    var r = await askEx(p, 300*grupo.length, 'flash');
    var arr = []; try { var m = r.t.match(/\[[\s\S]*\]/); if (m) arr = JSON.parse(m[0]); } catch(e){}
    var byId = {}; arr.forEach(function(o){ if (o && o.id) byId[String(o.id)] = o.texto || ''; });
    return grupo.map(function(a){
      var t = byId[a.id];
      return { id:a.id, agente:a.nome, ic:a.ic, cor:a.cor,
        texto:(t || ('⚠️ IA nao respondeu ('+(r.why||'sem JSON parseavel')+')')), _ok:!!t };
    });
  }

  try {
    // Rodada 1 — os 12 especialistas em 2 painéis de 6 (2 chamadas, não 12).
    var grupos = pedacos(ESP.AGENTES, 6);
    var posicoes = [];
    for (var gi=0; gi<grupos.length; gi++) {
      if (gi>0) await sleep(1000);
      posicoes = posicoes.concat(await painel(grupos[gi]));
    }
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
    var challenger = await ask(chP, 480, 'flash');

    // Rodada 3 — Coordenador sintetiza (modelo mais fundo, JSON)
    var coP = BASE + ESP.COORDENADOR + '\n\nPERGUNTA: "'+q+'".\nDEBATE:\n'+resumo+'\n\nCONTRADITORIO: '+challenger+'\n\nSintetize agora.';
    var coTxt = await ask(coP, 800, 'flash');
    var sintese=null; try { var m=coTxt.match(/\{[\s\S]*\}/); if(m) sintese=JSON.parse(m[0]); } catch(e){}

    var turnos = posicoes.concat([{ id:'risco', agente:'Auditoria · Contraditório', ic:'⚔️', cor:'#c77dff', texto:(challenger||'(sem resposta)') }]);
    return send(res, 200, { pergunta:q, turnos:turnos, sintese:sintese });
  } catch (e) {
    return send(res, 200, { pergunta:q, turnos:[], erro:String(e).slice(0,160) });
  }
};
