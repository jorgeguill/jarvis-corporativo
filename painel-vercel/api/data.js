// Helpers de autenticacao (login por usuario). Compartilhado por data/login/chat.
const crypto = require('crypto');
function parseUsers(){
  var raw = process.env.RADAR_USERS || '';
  var m = {};
  raw.split(/[,\n]/).forEach(function(p){ var i=p.indexOf(':'); if(i>0){ var u=p.slice(0,i).trim(); var s=p.slice(i+1).trim(); if(u) m[u]=s; } });
  return Object.keys(m).length ? m : null;
}
function secret(){ return process.env.RADAR_SECRET || crypto.createHash('sha256').update('radar|'+(process.env.RADAR_USERS||'')).digest('hex'); }
function b64u(buf){ return Buffer.from(buf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function mac(p){ return crypto.createHmac('sha256', secret()).update(p).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function sign(user){ var p=b64u(JSON.stringify({u:user, exp:Date.now()+7*24*3600*1000})); return p+'.'+mac(p); }
function verify(tok){ if(!tok||tok.indexOf('.')<0) return null; var a=tok.split('.'); var sig=mac(a[0]); var ok=false; try{ ok=crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(a[1])); }catch(e){ return null; } if(!ok) return null; try{ var o=JSON.parse(Buffer.from(a[0].replace(/-/g,'+').replace(/_/g,'/'),'base64').toString()); if(!o.exp||o.exp<Date.now()) return null; return o.u; }catch(e){ return null; } }
function tokenOf(req){ var h=req.headers['x-radar-auth']; if(h) return h; try{ return new URL(req.url,'http://x').searchParams.get('t')||''; }catch(e){ return ''; } }
function eq(a,b){ if(a==null||b==null) return false; var A=Buffer.from(String(a)), B=Buffer.from(String(b)); if(A.length!==B.length) return false; return crypto.timingSafeEqual(A,B); }

// -------- Interligação com o Painel Forno (controle de areia e óleo) --------
// Puxa os dados ao vivo do Firebase Realtime DB (mesma base que o app do forno usa).
// Ativa sozinho quando FORNO_DB_URL for configurado nas variáveis de ambiente.
// FORNO_URL = link para abrir o app do forno a partir do Radar.
async function jget(url, ms){
  var ctl = new AbortController(); var to = setTimeout(function(){ ctl.abort(); }, ms||2500);
  try { var r = await fetch(url, { signal: ctl.signal }); if(!r.ok) return null; return await r.json(); }
  catch(e){ return null; } finally { clearTimeout(to); }
}
function asList(v){ if(!v) return []; if(Array.isArray(v)) return v.filter(Boolean); return Object.keys(v).map(function(k){ return v[k]; }).filter(Boolean); }
async function fetchForno(){
  var base = (process.env.FORNO_DB_URL||'').replace(/\/+$/,'');
  var out = { url: process.env.FORNO_URL||'', params:{meta:8,umidade:8,densidade:1.5,tolerancia:15,concha_m3:2.1}, live:null };
  if(!base) return out;
  var res = await Promise.all([ jget(base+'/turnos.json'), jget(base+'/recebimentos.json'), jget(base+'/parametros.json') ]);
  var turnos = asList(res[0]), receb = asList(res[1]), pmt = res[2]||{};
  var umid=Number(pmt.umidade)||8, dens=Number(pmt.densidade)||1.5, meta=Number(pmt.meta)||8, tol=Number(pmt.tolerancia)||15, conchaM3=Number(pmt.concha_m3)||2.1;
  out.params = { meta:meta, umidade:umid, densidade:dens, tolerancia:tol, concha_m3:conchaM3 };
  if(!turnos.length){ return out; }
  // ---- Espelha a lógica do painel Supervisor (mesma matemática) ----
  function turnoConchas(t){ if(Array.isArray(t.lotes)&&t.lotes.length) return t.lotes.reduce(function(s,l){return s+(Number(l.conchas)||0);},0); return Number(t.conchas)||0; }
  function tonOf(t){ var m3u=Number(t.m3_umida); if(!isFinite(m3u)||m3u===0){ var c=turnoConchas(t); if(c)m3u=c*conchaM3; } m3u=m3u||0; return {m3u:m3u, ton:m3u*(1-umid/100)*dens}; }
  function precoMedio(){ var s=0,l=0; receb.forEach(function(r){ var p=Number(r.preco_litro), q=Number(r.depois)-Number(r.antes); if(isFinite(p)&&p>0&&isFinite(q)&&q>0){ s+=p*q; l+=q; } }); return l>0?s/l:2.5; }
  function mediaLton(){ var litros=receb.reduce(function(s,r){return s+((Number(r.depois)-Number(r.antes))||0);},0); var ton=turnos.reduce(function(s,t){return s+tonOf(t).ton;},0); return ton>0?litros/ton:0; }
  var media=mediaLton();
  function compute(t){
    var b=tonOf(t), ton=b.ton, oleo=0, medido=false;
    if(t.tanque_ini!==undefined&&t.tanque_ini!==''&&t.tanque_ini!==null&&t.tanque_fim!==undefined&&t.tanque_fim!==''&&t.tanque_fim!==null){ oleo+=(Number(t.tanque_ini)-Number(t.tanque_fim)); medido=true; }
    if(t.oleo_receb){ oleo+=Number(t.oleo_receb); medido=true; }
    if(t.oleo_consumido!==undefined&&t.oleo_consumido!==null&&t.oleo_consumido!==''){ oleo+=Number(t.oleo_consumido); medido=true; }
    var lton=Number(t.consumo_manual)||null, estimado=false;
    if(!lton&&medido&&oleo>0&&ton>0.01){ lton=oleo/ton; }
    else if(!lton&&ton>0.01){ if(media>0){ lton=media; oleo=ton*media; estimado=true; } }
    return {m3u:b.m3u, ton:ton, oleo:oleo, lton:lton, estimado:estimado};
  }
  var pmed=precoMedio();
  var computed=turnos.map(compute);
  var areiaTotal=0, tonSeca=0, oleoPeriodo=0;
  computed.forEach(function(c){ areiaTotal+=c.m3u||0; tonSeca+=c.ton||0; oleoPeriodo+=(isFinite(c.oleo)?c.oleo:0); });
  var ltons=computed.map(function(c){return c.lton;}).filter(function(v){return v!=null&&isFinite(v);});
  var mediaL=ltons.length?ltons.reduce(function(a,b){return a+b;},0)/ltons.length:0;
  var limite=meta*(1+tol/100), dentro=ltons.filter(function(v){return v<=limite;}).length;
  var oleoRecebido=receb.reduce(function(s,r){return s+((Number(r.depois)-Number(r.antes))||0);},0);
  var sorted=turnos.slice().sort(function(a,b){return new Date(a.data)-new Date(b.data);});
  var last=sorted[sorted.length-1], lastC=last?compute(last):null;
  var custo=oleoPeriodo*pmed;
  var status='sem'; if(lastC&&lastC.lton){ status=lastC.lton<=meta?'ok':(lastC.lton<=limite?'aten':'crit'); }
  out.live = {
    turnos: turnos.length,
    recebimentos: receb.length,
    areiaUmida_m3: +areiaTotal.toFixed(1),
    areiaSeca_ton: +tonSeca.toFixed(1),
    consumo_lton_medio: mediaL? +mediaL.toFixed(2) : null,
    consumo_lton_ultimo: (lastC&&lastC.lton)? +lastC.lton.toFixed(2) : null,
    ultimo_estimado: !!(lastC&&lastC.estimado),
    dentroMeta_pct: ltons.length? Math.round(dentro/ltons.length*100) : null,
    oleoRecebido_L: Math.round(oleoRecebido),
    oleoConsumido_L: Math.round(oleoPeriodo),
    preco_litro: +pmed.toFixed(2),
    custo_periodo: +custo.toFixed(0),
    custo_ton: tonSeca>0? +(custo/tonSeca).toFixed(2) : null,
    custo_m3: areiaTotal>0? +(custo/areiaTotal).toFixed(2) : null,
    status: status,
    ultimo: { data:last.data||'', turno:last.turno||'', operador:last.operador||'', silo:last.silo||'' }
  };
  return out;
}

function buildData(){
    var DATA={
      SKAL:{nome:'SKAL Engenharia',status:'aten',dados:true,
        kpis:[
          {l:'Caixa',v:'R$ 827,3 mil',st:'ok'},
          {l:'A Receber',v:'R$ 1,84 mi',st:'aten'},
          {l:'Inadimplência',v:'R$ 883,9 mil',st:'crit'},
          {l:'Lucro 2025',v:'R$ 2,86 mi',st:'ok'}
        ],
        alertAgents:['cob'],
        alerta:{
          tit:'Dívida antiga e permutas distorcem o caixa real',
          txt:'Contas e impostos estão em dia. Os dois pontos que realmente pesam: a inadimplência acima de 90 dias soma R$ 717,8 mil (81% da dívida) — dentro dela, R$ 152,6 mil são da Rivello, que quer trocar a dívida por imóvel (permuta), e não vira caixa; e as permutas baixadas como dinheiro (Gávea R$ 251 mil) inflam caixa e faturamento — então o caixa real é menor do que o painel sugere. Cruzando Cobrança e Contábil, o foco é recuperar a dívida antiga e trazer os imóveis de permuta para o patrimônio.',
          chips:[['cob','Cobrança'],['comp','Contábil'],['fin','Financeiro']],
          q:'Como R.A.D.A.R. Estratégico, cruze a inadimplência antiga e as permutas da SKAL (lembrando que contas e impostos estão em dia): qual o efeito no caixa real e quais as 3 a 4 ações prioritárias com evidência?'
        },
        eventos:[
          {t:'crit',tp:'Crítico',tt:'Rivello: R$ 173,8 mil de dívida (R$ 152,6 mil no +90) e o cliente quer NOVA PERMUTA (trocar por imóvel). Foi isso que empurrou o +90 para R$ 717,8 mil (+47,5 mil). Permuta NÃO é caixa — mesmo risco da Gávea. Avaliar imóvel, matrícula e registro no patrimônio antes de aceitar. Decisão de alto impacto: requer autorização da diretoria.',q:'Explique o caso da permuta da Rivello (R$ 173,8 mil) e o que analisar antes de aceitar.'},
          {t:'crit',tp:'Crítico',tt:'Inadimplência acima de 90 dias em R$ 717,8 mil — 81% da dívida. Tirando os 3 casos especiais (MRV, Vanguarda e Rivello), a inadimplência operacional real é R$ 565,9 mil. É nessa dívida operacional que a régua de cobrança deve focar.',q:'Detalhe a inadimplência acima de 90 dias e a inadimplência operacional (sem MRV, Vanguarda e Rivello).'},
          {t:'crit',tp:'Crítico',tt:'Permutas: R$ 251,1 mil (Gávea) baixados como dinheiro em caixa, mas a contrapartida foi imóvel. Risco de caixa inflado e imóvel fora do patrimônio.',q:'Explique o risco das permutas da Gávea e o que precisa ser corrigido.'},
          {t:'oport',tp:'Tendência',tt:'Lucro líquido: R$ 4,08 mi (2023) → R$ 1,32 mi (2024, ano de aperto por despesa) → R$ 2,86 mi (2025, recuperou). Receita cresce todo ano (R$ 33,86 mi em 2025). O foco de gestão é a despesa operacional, que ainda come boa parte da margem.',q:'Como está a trajetória de lucro e margem da SKAL e o que controlar?'},
          {t:'aten',tp:'Atenção',tt:'Patrimônio (Balanço 2024): imobilizado de R$ 7,37 mi cresceu R$ 1,1 mi no ano. Confirmar com a contabilidade se os imóveis de permuta estão registrados aí.',q:'Os imóveis de permuta estão no imobilizado do balanço de 2024?'},
          {t:'oport',tp:'Em dia',tt:'Contas e impostos em dia (confirmado pela diretoria). O que aparecia como "vencido" no relatório de 24/07 — R$ 1,29 mi, incluindo R$ 274 mil da Receita — eram contas já pagas e não baixadas no sistema. Não é atraso, é a mesma lição da baixa não lançada.',q:'As contas a pagar e os impostos da SKAL estão em atraso?'},
          {t:'oport',tp:'Oportunidade',tt:'Crédito livre no BB Giro de ~R$ 400 mil não utilizado — folga para capital de giro sem tomar dívida cara.',q:'Como usar melhor o crédito livre do BB Giro?'},
          {t:'prev',tp:'Previsão',tt:'Reforma tributária: a AREIA ficou FORA do Imposto Seletivo. Incentivos de ICMS valem até 2032 (com Fundo de Compensação para quem se habilitar).',q:'O que a reforma tributária muda para a SKAL nos próximos anos?'},
          {t:'oport',tp:'Positivo',tt:'2º trimestre de 2026 foi lucrativo (base R$ 982,8 mil). Mas IRPJ + CSLL somaram ~R$ 328 mil no trimestre (Lucro Real) — vale avaliar planejamento tributário.',q:'Como reduzir a carga de IRPJ e CSLL da SKAL no Lucro Real?'},
          {t:'oport',tp:'Fiscal · tendência',tt:'Carga fiscal estadual estável: março/2026 R$ 255.296,83 e julho/2026 R$ 263.803,40 (SPED 0002-89, PI). Para o caixa, provisionar ~R$ 255–265 mil/mês de tributos estaduais (ICMS Normal + ST + FUNEF + COTAC + DIFAL + parcelamento). O IPI acumula saldo credor (nada a recolher).',q:'Compare a carga fiscal estadual da SKAL entre março e julho/2026 e quanto provisionar por mês.'},
          {t:'crit',tp:'Vencimento 17/08',tt:'Tributos estaduais de 07/2026 (SPED 0002-89, PI): total R$ 263.803,40 vence 17/08/2026 — ICMS ST R$ 124.271,52; ICMS Normal R$ 95.674,61; FUNEF R$ 30.615,88; COTAC R$ 7.653,97; parcelamento ICMS (parcela 05/60) R$ 4.254,80; DIFAL R$ 1.332,62. Garantir provisão de caixa para a data.',q:'Detalhe os tributos de 07/2026 da SKAL que vencem em 17/08 e o total a provisionar.'},
          {t:'oport',tp:'Incentivo',tt:'ICMS 07/2026: o Crédito Presumido de 80% (Lei 6.146/11) abateu R$ 382.698,45 do imposto — sem ele o ICMS próprio saltaria de R$ 95,7 mil para ~R$ 478 mil. É o incentivo que sustenta a competitividade. IPI acumula saldo credor de R$ 650,5 mil (nada a recolher). Manter a habilitação em dia é prioridade estratégica.',q:'Explique o impacto do Crédito Presumido de 80% (Lei 6.146/11) no ICMS da SKAL e o risco de perder o incentivo.'},
          {t:'prev',tp:'Vencimento',tt:'Taxa de Localização de Parnaíba (R$ 660,83) vence em 22/08. Licença Ambiental (matriz) e Bombeiros (Parnaíba) válidos até 2027.',q:'Quais documentos e taxas da SKAL estão vencendo?'},
          {t:'oport',tp:'Produção',tt:'Produção de argamassa (marca Kalfix, empresa SKAL) — Banco Mestre REV4: 1,54 mi de sacos em jan–ago/2026 (23.172 t, 1.316 ordens). Picos em março (244,6k) e junho (244,8k). Mix: Master 38%, Interna Plus 27%, Externa 25%, Gold 7%. Consumo: Areia 17.983 t, Cimento 4.999 t.',q:'Analise a produção de argamassa da SKAL em jan–ago: volume, mix, turno e tendência.'},
          {t:'oport',tp:'Custo',tt:'Custo de material por saco (top-down, Compras por Centro de Custo jan–set/2026 ÷ 1,54 mi sacos jan–ago): matéria-prima R$ 2,78 + embalagem R$ 0,44 + forno/óleo R$ 0,27 = R$ 3,49/saco (≈ R$ 231,8/t). É estimativa top-down (compras ≠ consumo pelo estoque, e é média de todos os produtos). Para o custo unitário por insumo (areia, cimento, resina), falta o relatório de Compras por PRODUTO (quantidade × preço) — o Livro fiscal não traz linha de produto.',q:'Detalhe o custo de material por saco da SKAL (matéria-prima, embalagem, forno) e o que falta para o custo por insumo e a margem por produto.'},
          {t:'aten',tp:'Paradas',tt:'Paradas auditadas (63 revisadas): a FALTA DE ÁGUA domina a indisponibilidade (P0). Importante: a argamassa é pó seco e NÃO consome água no processo — a água é potável, do site (banheiros/bebedouros). Logo a parada é condição de trabalho da equipe (NR-24), com raiz no ABASTECIMENTO/RESERVATÓRIO de água potável, não no produto. Depois vem equipamento (rosca de cimento, ensacadeira, esteira). O total auditado é um piso — muitos registros têm motivo mas sem horário. Prioridade: tornar código, início, fim, responsável e impacto de cada parada obrigatórios.',q:'Quais as principais causas de parada na produção da SKAL e como reduzir a indisponibilidade?'},
          {t:'oport',tp:'Estratégia',tt:'Diagnóstico: gargalo é disponibilidade (abastecimento de água potável do site + equipamento) + sequência, não capacidade. A água NÃO é insumo do produto (pó seco): garantir reservatório/fornecimento potável para a equipe destrava a maior parada. Mix concentrado (top 3 = 90%) pede produção por CAMPANHAS + SMED. Recomendado: programa de 90 dias (garantir água potável e ativos críticos, campanhas, captura digital de tempos/perdas, custeio padrão). Falta o custo unitário dos insumos para fechar o custo por saco.',q:'Explique o programa de 90 dias recomendado para a produção da SKAL e por onde começar.'},
          {t:'oport',tp:'Equipes',tt:'Desempenho de equipes (jan–jul): vazão por hora quase igual (Diurno 9,26 t/h · Noturno 9,32), mas o diurno é +7% em mão de obra (1,66 vs 1,55 t/colaborador-h) e o noturno é mais estável. Aproveitamento da jornada: 87,6% do melhor mês — há ~14% (3.165 t) de oportunidade sem ampliar carga horária, concentrada no diurno (opera a 84,2% do próprio benchmark). Meta inicial viável: +10% (~2.229 t).',q:'Analise o desempenho das equipes diurna e noturna e onde está a maior oportunidade de aproveitamento da jornada.'}
        ],
        hoje:{decisoes:5,riscos:3,pendencias:8,oportunidades:4,
          det:{
            decisoes:'1) Acionar a régua de cobrança sobre os R$ 670,4 mil vencidos +90d.\n2) Levantar e registrar no patrimônio os imóveis de permuta (Gávea R$ 251,1 mil).\n3) Reconciliar o "recebido" do ERP contra o extrato de junho.\n4) Garantir a baixa no sistema das contas já pagas, para o relatório parar de mostrar "vencido".\n5) Controlar a despesa operacional, que ainda consome parte da margem (lição do DRE).',
            riscos:'1) Dívida antiga (+90d) com risco real de perda.\n2) Caixa-fantasma das permutas inflando caixa e resultado.\n3) Baixas não lançadas distorcem o painel (contas já pagas aparecem como vencidas).',
            pendencias:'1) Custo unitário dos insumos (areia, cimento, resina, embalagens) — fecha o custo por saco e a margem por produto.\n2) Ler contratos de permuta escaneados (Macedo Fortes, Franklin Chakal, Village do Sol).\n3) Cadastrar os contratos de permuta e registrar os imóveis no patrimônio (confirmar com a contabilidade).\n4) Corrigir na origem a soma MRV+Vanguarda do ACOMPCOB (diferença fixa de R$ 4.698: o certo é 146.167,40).\n5) Atualizar caixa e A Receber (referência ainda de 24/07).\n6) Preencher Qtd Paradas e Qtd Perda nas fichas de produção (para medir perda/rendimento).\n7) Corrigir governança das OFs (nº reutilizados 019731/019836; OF 020146 sem ID filho; data 2025×2026 na OF 020154).\n8) Ativar os agentes ainda vazios da SKAL: Estoque, Logística e Projetos.',
            oportunidades:'1) BB Giro de R$ 400 mil livre para capital de giro.\n2) Areia fora do Imposto Seletivo na reforma.\n3) Recuperar 0–30 (R$ 77,8 mil) e conter o 31–60 (R$ 70,6 mil).\n4) Decidir a permuta da Rivello (R$ 173,8 mil) — avaliar imóvel antes de aceitar.\n5) Fundo de Compensação de ICMS (habilitação).'
          }
        },
        nota:'Inadimplência: dados REAIS (ACOMPCOB 13/08). Caixa/A Receber referência de 24/07. Nenhuma ação de alto impacto sem sua autorização.',
        graf:[
          {tipo:'bars2',tit:'Receita × Lucro líquido',unid:'R$ milhões · 2023–2025',
           cats:['2023','2024','2025'],
           series:[{nome:'Receita',cor:'#2dff8c',vals:[24.68,30.46,33.86]},{nome:'Lucro',cor:'#d4b26a',vals:[4.08,1.32,2.86]}],
           q:'Analise a trajetória de receita e lucro líquido da SKAL de 2023 a 2025 (Receita 24,68 → 30,46 → 33,86 mi; Lucro 4,08 → 1,32 → 2,86 mi): o que explica a queda de lucro em 2024 e a recuperação em 2025, o que está acontecendo com a margem, e projete 2026.'},
          {tipo:'donut',tit:'Inadimplência por idade',unid:'R$ 883,9 mil · total',
           partes:[{nome:'0–30 dias',val:77.80,cor:'#2dff8c'},{nome:'30–90 dias',val:88.22,cor:'#e6c15a'},{nome:'+90 dias',val:717.85,cor:'#ff5b6e'}],
           q:'Analise a composição por idade da inadimplência da SKAL em 13/08 (0–30: R$ 77,8 mil; 31–60: R$ 70,6 mil; 61–90: R$ 17,6 mil; +90 dias: R$ 717,8 mil, 81% do total de R$ 883,9 mil). O +90 saltou +47,5 mil por causa da Rivello (R$ 152,6 mil, que quer permuta). Tirando MRV, Vanguarda e Rivello, a inadimplência operacional é R$ 565,9 mil. Explique e dê a estratégia por faixa.'},
          {tipo:'bars2',tit:'Faturamento mensal 2026',unid:'R$ milhões · líquido (ago parcial)',cats:['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago*'],
           series:[{nome:'Faturamento',cor:'#2dff8c',vals:[2.08,1.87,2.35,1.90,1.89,2.34,2.39,0.81]}],
           q:'Analise o faturamento mensal da SKAL em 2026 (jan 2,08; fev 1,87; mar 2,35; abr 1,90; mai 1,89; jun 2,34; jul 2,39 mi; ago parcial). Compare com a média de 2025 (2,12 mi/mês) e diga se o ano está acelerando, estável ou desacelerando, e projete o fechamento de 2026.'},
          {tipo:'bars2',tit:'Compras por centro de custo 2025',unid:'R$ milhões · ano',cats:['Mat-Prima','Admin','Embal.','Prod SKAL','Forno'],
           series:[{nome:'Compras',cor:'#e6c15a',vals:[8.53,4.05,2.66,2.61,0.96]}],
           q:'Analise as compras da SKAL por centro de custo em 2025 (Matéria-Prima 8,53 mi, Administrativo 4,05, Embalagens 2,66, Produção SKAL 2,61, Forno 0,96): onde está o maior gasto, o que é custo variável de produção, e onde há espaço para negociação com fornecedores.'},
          {tipo:'bars2',tit:'Previsão de caixa · desembolsos do mês',unid:'R$ mil · por data de saída',cats:['Folha (dia 03)','Encargos (~20)','Tributos (17)'],
           series:[{nome:'Saída prevista',cor:'#ff5b6e',vals:[152.3,70.0,263.8]}],
           q:'Monte a PREVISÃO DE CAIXA do mês da SKAL como um calendário de desembolsos recorrentes, na ordem das datas: dia 03 folha líquida R$ 152,3 mil (SKAL 124,29 + KALFIX 27,96); ~dia 20 encargos INSS+FGTS ~R$ 70,0 mil (data a confirmar); dia 17 tributos estaduais ~R$ 263,8 mil (ICMS Normal+ST+FUNEF+COTAC+DIFAL+parcela). Total de saídas recorrentes conhecidas ≈ R$ 486 mil/mês. Confronte com o caixa atual (~R$ 827,3 mil, ref. 24/07) e o crédito livre BB Giro (~R$ 400 mil). Trate contas a pagar apenas para frente como previsão. Mostre o saldo projetado ao longo do mês, aponte a data de maior aperto e conclua se sobra ou aperta, com recomendação.'}
        ],
        entradas:{data:'13/08 · fluxo',
          cards:[['Faturamento do dia','R$ 154,0 mil','ok'],['Resgatado','R$ 9,3 mil','ok'],['Venceu no dia','R$ 4,5 mil','aten'],['Previsão 17–21/08','R$ 470,1 mil','oport']],
          graf:{tipo:'bars2',tit:'Previsão de entrada · 17–21/08',unid:'R$ mil',cats:['17/08','18/08','19/08','20/08','21/08'],
            series:[{nome:'Previsto',cor:'#57b6ff',vals:[65.39,188.45,83.58,74.60,58.13]}]},
          q:'Analise as entradas do dia 13/08 da SKAL (faturamento do dia R$ 153.984,82 — à vista NFe 38.736,80, NG 7.304,84, a prazo 107.943,18; resgatado de inadimplência R$ 9.348,04; venceu e não pagou R$ 4.487,50) e a previsão de entrada de 17 a 21/08 (17/08 65.386,50; 18/08 188.448,52; 19/08 83.580,03; 20/08 74.599,80; 21/08 58.129,79; total 470.144,64). O que isso diz sobre o fluxo de caixa da semana, considerando a folha mensal (~124 mil líquido) e as saídas recorrentes, e o que priorizar na cobrança e no caixa?'},
        producao:{data:'jan–ago 2026 · 1.316 ordens · marca Kalfix',
          cards:[['Produção (jan–ago)','1,54 mi sc','ok'],['Ordens (consolidadas)','1.316','ok'],['Areia consumida','17.983 t','aten'],['Cimento consumido','4.999 t','aten']],
          graf:[
            {tipo:'bars2',tit:'Produção por mês',unid:'mil sacos · 2026 (ago parcial)',cats:['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago*'],
             series:[{nome:'Sacos',cor:'#2dff8c',vals:[199.8,187.5,244.6,187.6,191.2,244.8,228.9,58.5]}],
             q:'Analise a produção mensal de argamassa da SKAL em 2026 (Jan 199,8 mil sacos; Fev 187,5; Mar 244,6; Abr 187,6; Mai 191,2; Jun 244,8; Jul 228,9; Ago 58,5 parcial): tendência, sazonalidade (março e junho os picos) e projete o fechamento do ano.'},
            {tipo:'donut',tit:'Mix por produto',unid:'1,54 mi sacos',center:'mil sacos',legpre:'',legsuf:' mil sc',
             partes:[{nome:'Master',val:581.7,cor:'#2dff8c'},{nome:'Interna Plus',val:419.8,cor:'#57b6ff'},{nome:'Externa',val:382.1,cor:'#e6c15a'},{nome:'Gold',val:112.8,cor:'#c78bff'},{nome:'Outros',val:46.3,cor:'#8a99a6'}],
             q:'Analise o mix de produtos da produção da SKAL em jan–ago (Master 37,7%, Interna Plus 27,2%, Externa 24,8%, Gold 7,3%): concentração (top 3 = 90%) e a estratégia de produção por campanhas.'},
            {tipo:'bars2',tit:'Produção por turno',unid:'mil sacos · jan–ago',cats:['Diurno','Noturno'],
             series:[{nome:'Sacos',cor:'#57b6ff',vals:[856.6,686.2]}],
             q:'Compare a produção por turno da SKAL em jan–ago (Diurno 856,6 mil sacos / 55,5%; Noturno 686,2 / 44,5%): equilíbrio de capacidade e balanceamento.'},
            {tipo:'donut',tit:'Consumo de insumos',unid:'toneladas · jan–ago',center:'toneladas',legpre:'',legsuf:' t',
             partes:[{nome:'Areia',val:17983,cor:'#e6c15a'},{nome:'Cimento',val:4999,cor:'#8a99a6'},{nome:'Resina',val:130.8,cor:'#2dff8c'},{nome:'Celulose',val:51.6,cor:'#57b6ff'}],
             q:'Analise o consumo de insumos da produção da SKAL em jan–ago (Areia 17.983 t, Cimento 4.999 t, Resina 130,8 t, Celulose 51,6 t) e o que falta para fechar o custo por saco.'},
            {tipo:'bars2',tit:'Produtividade por turno · t/h',unid:'t/h de jornada · jan–jul',cats:['Jan','Fev','Mar','Abr','Mai','Jun','Jul'],
             series:[{nome:'Diurno',cor:'#2dff8c',vals:[8.43,8.57,10.99,7.96,8.60,10.93,9.23]},{nome:'Noturno',cor:'#57b6ff',vals:[8.91,9.33,10.00,8.29,8.77,10.11,9.76]}],
             q:'Compare a produtividade por turno da SKAL (t/h de jornada, jan–jul): consolidado Diurno 9,26 t/h e Noturno 9,32 t/h (praticamente empate); em mão de obra o diurno entrega 1,66 t/colaborador-hora vs 1,55 do noturno (+7%); o noturno é mais estável (CV 7,4% vs 13,3%). Melhores meses: março (diurno 10,99) e junho (noturno 10,11). O que isso diz e o que fazer.'},
            {tipo:'bars2',tit:'Aproveitamento da jornada',unid:'% do melhor mês da equipe · jan–jul',cats:['Diurno','Noturno','Consolidado'],
             series:[{nome:'Aproveitamento',cor:'#e6c15a',vals:[84.2,92.2,87.6]}],
             q:'Analise o aproveitamento da carga horária da SKAL: realizado 22.293 t vs potencial de 25.458 t (benchmark do melhor mês de cada equipe) — gap de 3.165 t (+14,2% teto teórico). O diurno opera a 84,2% do próprio benchmark (gap 2.320 t, a maior oportunidade) e o noturno a 92,2% (gap 844 t). Uma meta inicial de +10% adicionaria ~2.229 t sem ampliar a jornada. O gap não é perda comprovada (pode ser setup, espera, manutenção, abastecimento, demanda). O que priorizar.'}
          ]}
      },
      KALFIX:{nome:'KALFIX',status:'parc',dados:true,parcial:true,
        kpis:[{l:'Funcionários',v:'23',st:'ok'},{l:'Folha líq./mês',v:'R$ 28 mil',st:'ok'},{l:'Faturam. (NFS-e)',v:'a lançar',st:'sem'},{l:'Caixa',v:'a lançar',st:'sem'}],
        alertAgents:[],
        eventos:[
          {t:'aten',tp:'Empresa',tt:'A empresa KALFIX presta SERVIÇOS a construtoras e emite NFS-e (nota de serviço) — não emite nota de material. Não confundir com a MARCA Kalfix dos produtos de argamassa, que são da SKAL.',q:'O que é a empresa KALFIX e como ela difere da marca Kalfix dos produtos da SKAL?'},
          {t:'oport',tp:'Folha',tt:'Único dado lançado até agora: folha de pagamento — 23 funcionários, líquido de julho R$ 27.955,24 (~28 mil/mês). Simples Nacional.',q:'Como está a folha de pagamento da KALFIX?'},
          {t:'aten',tp:'Sequência',tt:'A empresa KALFIX será alimentada DEPOIS de concluirmos a SKAL e a QUIMIKA. Por ora, só a folha está lançada; faturamento de serviços (NFS-e) e caixa virão na sequência.',q:'O que falta para ativar a empresa KALFIX e quando?'}
        ],
        nota:'KALFIX (empresa): presta serviços a construtoras (NFS-e). Por ora só a folha está lançada. Será alimentada após SKAL e QUIMIKA. Não confundir com a marca Kalfix dos produtos da SKAL.'
      },
      QUIMIKA:{nome:'QUIMIKA',status:'sem',dados:false},
      FCK:{nome:'FCK',status:'sem',dados:false}
    };
    var ORDER=['SKAL','KALFIX','QUIMIKA','FCK'];
    // Gráfico por agente (só dados reais). Monta a partir do DATA.
    (function(){var s=DATA.SKAL;if(!s.graf)return;var receita=s.graf[0],aging=s.graf[1];
      var fiscal={tipo:'bars2',tit:'Tributos estaduais · mar × jul/2026',unid:'R$ mil · a recolher',cats:['ICMS ST','ICMS Norm','FUNEF','COTAC'],
        series:[{nome:'mar/26',cor:'#57b6ff',vals:[112.61,91.12,29.16,7.29]},{nome:'jul/26',cor:'#ff5b6e',vals:[124.27,95.67,30.62,7.65]}],
        q:'Analise os tributos estaduais da SKAL (SPED filial 0002-89, PI) comparando março e julho/2026. Totais a recolher: MARÇO R$ 255.296,83 (ICMS Normal 91.115,67; ST 112.606,11; DIFAL 11.055,47; COTAC 7.289,25; FUNEF 29.157,01; parcela ICMS 02/60 4.073,32; venceu 15/04). JULHO R$ 263.803,40 (ICMS Normal 95.674,61; ST 124.271,52; DIFAL 1.332,62; COTAC 7.653,97; FUNEF 30.615,88; parcela 05/60 4.254,80; vence 17/08). A carga fiscal estadual é estável em ~R$ 255–264 mil/mês. O Crédito Presumido de 80% (Lei 6.146/11) sustenta isso; o IPI acumula saldo credor (650,5 mil em jul). Explique a tendência, o peso da ST e o que provisionar por mês.'};
      var folha={tipo:'bars2',tit:'Folha líquida · julho/2026',unid:'R$ mil',cats:['SKAL','KALFIX'],
        series:[{nome:'Líquido',cor:'#2dff8c',vals:[124.29,27.96]}],
        q:'Analise a folha líquida de julho/2026 (SKAL 124,29 mil com 75 funcionários; KALFIX 27,96 mil com 23), o peso dos encargos e a saída de caixa mensal recorrente.'};
      var caixa={tipo:'bars2',tit:'Recursos disponíveis',unid:'R$ mil · ref. 24/07',cats:['Caixa BB','Crédito livre'],
        series:[{nome:'Disponível',cor:'#2dff8c',vals:[827.3,400]}],
        q:'Analise a liquidez da SKAL: caixa no Banco do Brasil ~827,3 mil (ref. 24/07) e crédito BB Giro livre ~400 mil não usado. Lembre que permutas baixadas como caixa inflam o saldo — qual o caixa real e como usar o crédito livre com disciplina.'};
      var docs={tipo:'days',tit:'Vencimentos · documentos e taxas',unid:'dias até o vencimento',
        items:[{nome:'Taxa Localização (Parnaíba)',date:'2026-08-22'},{nome:'AVCB Bombeiros (Parnaíba)',date:'2027-07-15'},{nome:'Licença Ambiental (matriz)',date:'2027-12-31'}],
        q:'Liste os vencimentos de documentos e taxas da SKAL por prazo (Taxa de Localização de Parnaíba 22/08/2026; AVCB Bombeiros 15/07/2027; Licença Ambiental da matriz 31/12/2027) e o que providenciar com antecedência.'};
      var fatmes=s.graf[2],compras=s.graf[3];
      var pg=(s.producao&&s.producao.graf)||[];
      s.chartsByAgent={fin:caixa,cob:aging,com:fatmes,cmp:compras,prod:pg[0],est:pg[3],dir:receita,est2:receita,bi:receita,comp:aging,fis:fiscal,rh:folha,doc:docs};
      s.ghostByAgent={
        est:{tit:'Estoque',hint:'Para ligar o gráfico: envie a posição de estoque (itens, quantidade, giro, ruptura).'},
        cmp:{tit:'Compras',hint:'Para ligar o gráfico: envie as compras por fornecedor e os preços praticados.'},
        prod:{tit:'Operações',hint:'Para ligar o gráfico: envie a produção mensal (volume, capacidade, custo).'},
        log:{tit:'Logística',hint:'Para ligar o gráfico: envie entregas, prazos e custo de frete.'},
        proj:{tit:'Projetos',hint:'Para ligar o gráfico: envie a lista de projetos com status e prazos.'},
        inc:{tit:'Incentivos',hint:'Para ligar o gráfico: envie o valor dos incentivos de ICMS e a economia gerada.'}
      };
    })();
  return { DATA: DATA, ORDER: ORDER };
}

async function payloadWithForno(){
  var p = buildData();
  try { p.FORNO = await fetchForno(); } catch(e) { p.FORNO = { url: process.env.FORNO_URL||'', params:{meta:8,umidade:8,densidade:1.5}, live:null }; }
  return p;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-radar-auth');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  var users = parseUsers();
  if (!users) { res.statusCode = 200; return res.end(JSON.stringify({ auth: false, payload: await payloadWithForno() })); }
  var u = verify(tokenOf(req));
  if (!u) { res.statusCode = 401; return res.end(JSON.stringify({ auth: true })); }
  res.statusCode = 200; return res.end(JSON.stringify({ auth: true, user: u, payload: await payloadWithForno() }));
};
