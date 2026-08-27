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
          {l:'Caixa',v:'R$ 651,2 mil',st:'ok'},
          {l:'A Receber',v:'R$ 1,84 mi',st:'aten'},
          {l:'Inadimplência',v:'R$ 832,8 mil',st:'crit'},
          {l:'Lucro 2025',v:'R$ 2,86 mi',st:'ok'}
        ],
        alertAgents:['cob'],
        alerta:{
          tit:'Dívida antiga e permutas distorcem o caixa real',
          txt:'Contas e impostos estão em dia. Os dois pontos que realmente pesam: a inadimplência acima de 90 dias soma R$ 717,8 mil (81% da dívida) — dentro dela, R$ 152,6 mil são da Rivello, que quer trocar a dívida por imóvel (permuta), e não vira caixa; e as permutas baixadas como dinheiro (Gávea R$ 254,9 mil) inflam caixa e faturamento — então o caixa real é menor do que o painel sugere. Cruzando Cobrança e Contábil, o foco é recuperar a dívida antiga e trazer os imóveis de permuta para o patrimônio.',
          chips:[['cob','Cobrança'],['comp','Contábil'],['fin','Financeiro']],
          q:'Como R.A.D.A.R. Estratégico, cruze a inadimplência antiga e as permutas da SKAL (lembrando que contas e impostos estão em dia): qual o efeito no caixa real e quais as 3 a 4 ações prioritárias com evidência?'
        },
        eventos:[
          {t:'crit',tp:'Crítico',tt:'Rivello: R$ 173,8 mil de dívida (R$ 152,6 mil no +90) e o cliente quer NOVA PERMUTA (trocar por imóvel). Foi isso que empurrou o +90 para R$ 717,8 mil (+47,5 mil). Permuta NÃO é caixa — mesmo risco da Gávea. Avaliar imóvel, matrícula e registro no patrimônio antes de aceitar. Decisão de alto impacto: requer autorização da diretoria.',q:'Explique o caso da permuta da Rivello (R$ 173,8 mil) e o que analisar antes de aceitar.'},
          {t:'crit',tp:'Crítico',tt:'Inadimplência total R$ 832,8 mil (24/08) — recuou R$ 70,4 mil desde 18/08 (parte por cobrança, parte porque a base agora começa em 01/08/2021, saindo a dívida de 5+ anos). O dia teve R$ 33,0 mil de novos atrasos e R$ 14,0 mil resgatados. Acima de 90 dias: R$ 640,4 mil (76,9% da dívida). Tirando os 3 casos especiais (MRV 94,9 mil em cobrança judicial, Vanguarda 49,3 mil, Rivello 173,8 mil), a inadimplência operacional (soma das faixas líquidas) é R$ 514,8 mil — 0–30 R$ 89,3 mil; 31–60 R$ 61,7 mil; 61–90 R$ 11,0 mil; +90 R$ 352,8 mil. É nessa dívida operacional que a régua de cobrança deve focar.',q:'Detalhe a inadimplência de 24/08 por faixa e a inadimplência operacional (sem MRV, Vanguarda e Rivello), com as faixas líquidas.'},
          {t:'crit',tp:'Crítico',tt:'Permutas · Gávea: R$ 254.853,00 (33 NF-e, de 12/2023 a 03/2025) baixados no caixa 16.09 como "Depósito na Baixa" — ou seja, registrados como se fosse dinheiro, mas a contrapartida foi imóvel (apartamento na praia, Vistamar Coqueiro). É dinheiro que nunca entrou no banco: infla o caixa e o faturamento, e o imóvel fica fora do patrimônio. Corrigir a classificação (permuta, não recebimento) e registrar o imóvel no imobilizado.',q:'Explique o risco da permuta da Gávea (R$ 254.853,00 baixados como dinheiro no caixa 16.09) e o que precisa ser corrigido na contabilidade e no imobilizado.'},
          {t:'aten',tp:'Permutas · Patrimônio',tt:'Reconciliação: valor dos imóveis R$ 3,76 mi; material já compensado R$ 1,63 mi (43%); SALDO de material a entregar R$ 2,13 mi (obrigação futura de estoque, não caixa). Regra: conta como permuta até fechar o valor do imóvel. A Gávea foi revisada pelos dados de faturamento (Encontro de Contas 16.09): só R$ 254,9 mil compensados, faltam R$ 425,1 mil — NÃO está quitada (a PERMUTA_SALDO indicava quitada, mas o faturamento mostra o real). Perto de fechar: Boa Vista (falta 135 mil). Ainda inteiras: Triunfo, Felipe Melo, Macedo, Nailson. Registrar os R$ 3,76 mi de imóveis no imobilizado (conferir contra os 7,37 mi de 2024).',q:'Explique a reconciliação das permutas da SKAL (valor R$ 3,76 mi, compensado R$ 1,63 mi, saldo a entregar R$ 2,13 mi), a revisão da Gávea pelo faturamento (R$ 254,9 mil compensados, R$ 425,1 mil a entregar), quais estão perto de fechar, e o que registrar no imobilizado.'},
          {t:'oport',tp:'Tendência',tt:'Lucro líquido: R$ 4,08 mi (2023) → R$ 1,32 mi (2024, ano de aperto por despesa) → R$ 2,86 mi (2025, recuperou). Receita cresce todo ano (R$ 33,86 mi em 2025). O foco de gestão é a despesa operacional, que ainda come boa parte da margem.',q:'Como está a trajetória de lucro e margem da SKAL e o que controlar?'},
          {t:'aten',tp:'Atenção',tt:'Patrimônio (Balanço 2024): imobilizado de R$ 7,37 mi cresceu R$ 1,1 mi no ano. Confirmar com a contabilidade se os imóveis de permuta estão registrados aí.',q:'Os imóveis de permuta estão no imobilizado do balanço de 2024?'},
          {t:'oport',tp:'Em dia',tt:'Contas e impostos em dia (confirmado pela diretoria). O que aparecia como "vencido" no relatório de 24/07 — R$ 1,29 mi, incluindo R$ 274 mil da Receita — eram contas já pagas e não baixadas no sistema. Não é atraso, é a mesma lição da baixa não lançada.',q:'As contas a pagar e os impostos da SKAL estão em atraso?'},
          {t:'oport',tp:'Oportunidade',tt:'Crédito livre no BB Giro de ~R$ 400 mil não utilizado — folga para capital de giro sem tomar dívida cara.',q:'Como usar melhor o crédito livre do BB Giro?'},
          {t:'prev',tp:'Previsão',tt:'Reforma tributária: a AREIA ficou FORA do Imposto Seletivo. Incentivos de ICMS valem até 2032 (com Fundo de Compensação para quem se habilitar).',q:'O que a reforma tributária muda para a SKAL nos próximos anos?'},
          {t:'oport',tp:'Positivo',tt:'2º trimestre de 2026 foi lucrativo (base R$ 982,8 mil). Mas IRPJ + CSLL somaram ~R$ 328 mil no trimestre (Lucro Real) — vale avaliar planejamento tributário.',q:'Como reduzir a carga de IRPJ e CSLL da SKAL no Lucro Real?'},
          {t:'crit',tp:'Movimento 17/08',tt:'Movimento de caixa de 17/08: débitos no BB R$ 476.161,79 (impostos 263,8 mil + boletos/fornecedores 122,3 mil + PIX/TED 90,0 mil + tarifas 0,13 mil), contra controle de pagamentos de R$ 436.459,44. A conciliação fecha praticamente (resíduo ~R$ 9,95), MAS há 4 PONTOS DE EXCEÇÃO para a diretoria: (1) TED de R$ 47.526,13 ao BNB da própria SKAL inclui R$ 24.000 de reforço de caixa entre contas — NÃO é despesa, reclassificar; (2) R$ 20.000 a Franklin Kalume Brígido só com comprovante PIX, SEM documento fiscal/contrato/autorização — conferência prioritária; (3) R$ 19.999,75 de Cartão Caixa P/F debitado sem fatura analítica no pacote; (4) R$ 3.000 de frete (Alcimar) marcado "aguardando Débora autorizar" — não tratar como pago. Posição BB no fim do dia: saldo R$ 163.678,15 + resgate automático R$ 421.153,09 = R$ 584.831,24 (compromissos futuros já informados: empréstimo 22/08 R$ 32,3 mil + cartão 24/08 R$ 169,2 mil).',q:'Detalhe o movimento de caixa de 17/08 da SKAL e os 4 pontos de exceção (R$ 24 mil BNB, R$ 20 mil Franklin, R$ 20 mil Cartão Caixa, R$ 3 mil frete Alcimar): o que levar à diretoria antes de encerrar o dia.'},
          {t:'oport',tp:'Caixa 25/08',tt:'Posição bancária de 25/08 (extratos BB + CEF) — liquidez total R$ 651,2 mil: BB conta corrente + resgate automático (Rende Fácil) R$ 245,1 mil; BB CDB DI R$ 405,4 mil; Caixa Econômica R$ 0,7 mil (conta usada para a folha, paga 03/08 R$ 120,4 mil). Subiu dos R$ 584,8 mil de 17/08. Reserva não usada: crédito BB Giro R$ 400 mil (teto até 03/2027) + limite especial R$ 50 mil. Contra isso, vencem até 31/08 os tributos federais (~R$ 213,6 mil) — o caixa cobre, apoiado pelas entradas previstas de 31/08 e 01/09.',q:'Detalhe a posição de caixa da SKAL em 25/08 (BB conta+resgate R$ 245,1 mil, CDB R$ 405,4 mil, CEF R$ 0,7 mil) e se cobre os vencimentos federais até 31/08.'},
          {t:'oport',tp:'Fechamento · Agosto',tt:'Fechamento de caixa de agosto/2026: entradas (a receber) R$ 2.260,2 mil × saídas R$ 1.663,6 mil (fornecedores 1.177,5 + folha 152,3 + tributos 263,8 + encargos 70,0) = resultado +R$ 596,6 mil. Caixa projetado no fim do mês ~R$ 1.423,9 mil, mais R$ 400 mil de crédito livre. Folha (dia 03) e tributos (dia 17) já saíram. Mês positivo e saudável.',q:'Apresente o fechamento de caixa de agosto/2026 da SKAL (entradas 2.260,2 × saídas 1.663,6 = +596,6 mil) e o que observar em setembro.'},
          {t:'oport',tp:'Fluxo de caixa',tt:'Lançamentos 2026 (posição 17/08) — REGRA: contas a pagar com vencimento até o dia 17 já estão PAGAS (baixa não lançada). Assim, os R$ 3,23 mi que apareciam como "a pagar vencido em aberto" já saíram; o a pagar REAL daqui pra frente é R$ 2,22 mi (18–31/08 R$ 0,89 mi + set em diante R$ 1,32 mi). A receber a realizar R$ 7,17 mi. No resto de agosto entra ~R$ 1,38 mi e sai R$ 0,89 mi (sobra). Setembro segue folgado; nov/dez apertam. Folha (dia 03) e tributos (dia 17) somam por fora.',q:'Monte a previsão de caixa da SKAL aplicando a regra de que contas a pagar até o dia 17 já foram pagas (baixa não lançada): a pagar real daqui pra frente é R$ 2,22 mi. Some folha (dia 03) e tributos (dia 17) e diga mês a mês se sobra ou aperta.'},
          {t:'oport',tp:'Fiscal · tendência',tt:'Carga fiscal estadual estável: março/2026 R$ 255.296,83 e julho/2026 R$ 263.803,40 (SPED 0002-89, PI). Para o caixa, provisionar ~R$ 255–265 mil/mês de tributos estaduais (ICMS Normal + ST + FUNEF + COTAC + DIFAL + parcelamento). O IPI acumula saldo credor (nada a recolher).',q:'Compare a carga fiscal estadual da SKAL entre março e julho/2026 e quanto provisionar por mês.'},
          {t:'crit',tp:'Vencimento 17/08',tt:'Tributos estaduais de 07/2026 (SPED 0002-89, PI): total R$ 263.803,40 vence 17/08/2026 — ICMS ST R$ 124.271,52; ICMS Normal R$ 95.674,61; FUNEF R$ 30.615,88; COTAC R$ 7.653,97; parcelamento ICMS (parcela 05/60) R$ 4.254,80; DIFAL R$ 1.332,62. Garantir provisão de caixa para a data.',q:'Detalhe os tributos de 07/2026 da SKAL que vencem em 17/08 e o total a provisionar.'},
          {t:'crit',tp:'Vencimento 20–31/08',tt:'Tributos FEDERAIS de 07/2026 (matriz, Lucro Real) — total R$ 213,6 mil, vencendo entre 20 e 31/08: COFINS R$ 111.278,74 (25/08); PIS R$ 24.156,36 (25/08); IRPJ 2ª quota do 2º trim R$ 34.288,52 (31/08); CSLL 2ª quota R$ 29.780,30 (31/08); retenções na fonte R$ 33,75 (20/08); parcelamentos PGFN — parcela 109 R$ 11.613,31, Multas CLT 07/60 R$ 653,96 e INSS/PERT 104 R$ 1.779,81 (31/08). Somando com os estaduais (R$ 263,8 mil no dia 17), agosto tem ~R$ 477 mil só de imposto, mais a folha (R$ 152,3 mil no dia 03) — mês de carga pesada, provisionar. PIS/COFINS já é líquido dos créditos que a SKAL toma sobre insumos (celulose, calcário, diesel, frete).',q:'Detalhe os tributos federais de 07/2026 da SKAL (PIS, COFINS, IRPJ, CSLL, retenções e parcelamentos), as datas de vencimento e o impacto no caixa de agosto somado aos estaduais e à folha.'},
          {t:'oport',tp:'Incentivo',tt:'ICMS 07/2026: o Crédito Presumido de 80% (Lei 6.146/11) abateu R$ 382.698,45 do imposto — sem ele o ICMS próprio saltaria de R$ 95,7 mil para ~R$ 478 mil. É o incentivo que sustenta a competitividade. IPI acumula saldo credor de R$ 650,5 mil (nada a recolher). Manter a habilitação em dia é prioridade estratégica.',q:'Explique o impacto do Crédito Presumido de 80% (Lei 6.146/11) no ICMS da SKAL e o risco de perder o incentivo.'},
          {t:'crit',tp:'Incentivo · Grupo',tt:'INCENTIVOS FISCAIS DAS 3 EMPRESAS (docs CODIN/SEFAZ-PI): SKAL, QUIMIKA (CNPJ 11.262.306/0001-32) e FCK (F.C.K. Ind. e Com. Mat. Construção, CNPJ 08.794.766/0001-05) têm incentivo de ICMS do Piauí (Lei 6.146/2011). Decretos concessivos: SKAL 40.249/2000 (prorrog. 15.925/2014), QUIMIKA 14.300/2010 (alt. 45.954/2015), FCK 12.645/2007 (prorrog. 13.275/2008). O benefício é ESCALONADO e DECRESCENTE (ex.: FCK 100%→90%→80%→60%); a prorrogação vigente é regida pelo Decreto 19.408/2020. É o que sustenta o Crédito Presumido de ~80% da SKAL (abate ~R$ 383 mil/mês). RISCO: como decresce e vence, o percentual e a validade de 2026 precisam ser confirmados por empresa (os pareceres em mãos vão até 2020). O grupo também avalia a LEI DO BEM (Lei 11.196/2005, P&D federal). Manter habilitação/prorrogação em dia é prioridade — entra no Fundo de Compensação (até 2032) na Reforma.',q:'Explique os incentivos de ICMS do Piauí das 3 empresas (SKAL, QUIMIKA, FCK), o escalonamento decrescente, a prorrogação (Decreto 19.408/2020), o risco de vencimento e a Lei do Bem em avaliação.'},
          {t:'prev',tp:'Vencimento',tt:'Taxa de Localização de Parnaíba (R$ 660,83) vence em 22/08. Licença Ambiental (matriz) e Bombeiros (Parnaíba) válidos até 2027.',q:'Quais documentos e taxas da SKAL estão vencendo?'},
          {t:'oport',tp:'Produção',tt:'Produção de argamassa (marca Kalfix, empresa SKAL) — Banco Mestre REV4: 1,54 mi de sacos em jan–ago/2026 (23.172 t, 1.316 ordens). Picos em março (244,6k) e junho (244,8k). Mix: Master 38%, Interna Plus 27%, Externa 25%, Gold 7%. Consumo: Areia 17.983 t, Cimento 4.999 t.',q:'Analise a produção de argamassa da SKAL em jan–ago: volume, mix, turno e tendência.'},
          {t:'oport',tp:'RH · Pessoal',tt:'Quadro de pessoal do grupo (templates de migração NetSuite): 99 funcionários — SKAL 76, KALFIX 23. SKAL: Administração/Geral 25, Mão de Obra Direta 22 (produção), Indireta 15, Comercial 14 (motoristas de entrega); 22 serventes e 13 motoristas puxam o quadro. KALFIX são 23 trabalhadores de obra/serviço (9 aplicadores de impermeabilizante, serventes, gesseiros) alocados a projetos de clientes (SC2 Shopping 7, Rivello 3, C P Engenharia 2) — confirma que a KALFIX presta serviço de impermeabilização. Folha líquida julho: SKAL R$ 124,3 mil, KALFIX R$ 28,0 mil.',q:'Analise o quadro de pessoal do grupo (SKAL 76 + KALFIX 23), a distribuição por área e a relação com a folha e a produtividade.'},
          {t:'oport',tp:'NetSuite',tt:'Migração para o Oracle NetSuite (Fase 5 do roadmap) EM ANDAMENTO — chegaram os templates de cadastro já preenchidos: base de 7.072 clientes PJ (+ PF), contas contábeis (finanças e impostos), categorias de despesa, alçadas de aprovação e as subsidiárias. Estrutura legal do grupo: SKAL Engenharia com 3 estabelecimentos (matriz 0001-06 + filiais 0002-89 e 0004-40), KALFIX Indústria e Comércio (73.726.192/0001-91) e QUIMIKA Industrial (11.262.306/0001-32). A base cadastral está sendo estruturada para substituir o TOTVS RM; os ~7 mil clientes PJ trazem o representante associado (liga com as comissões).',q:'Explique o estágio da migração para o NetSuite (Fase 5): que cadastros já chegaram, a estrutura legal do grupo (5 CNPJs) e o que falta para migrar do TOTVS.'},
          {t:'oport',tp:'Custo',tt:'Custo de material por saco (top-down, Compras por Centro de Custo jan–set/2026 ÷ 1,54 mi sacos jan–ago): matéria-prima R$ 2,78 + embalagem R$ 0,44 + forno/óleo R$ 0,27 = R$ 3,49/saco (≈ R$ 231,8/t). É estimativa top-down (compras ≠ consumo pelo estoque, e é média de todos os produtos). Para o custo unitário por insumo (areia, cimento, resina), falta o relatório de Compras por PRODUTO (quantidade × preço) — o Livro fiscal não traz linha de produto.',q:'Detalhe o custo de material por saco da SKAL (matéria-prima, embalagem, forno) e o que falta para o custo por insumo e a margem por produto.'},
          {t:'oport',tp:'Custo',tt:'MODELO DE CUSTO POR PRODUTO (bottom-up, auditável). Metodologia: custo/saco = Σ(kg do insumo por saco × R$/kg do insumo) + embalagem, com kg/saco = kg do traço ÷ 100 (linha 15 kg) ou ÷ 75 (Multiuso 20 kg). Receita REAL por saco de 15 kg (Banco Mestre REV4, aba Materiais): Master Super Top → areia 11,31 kg + cimento 3,50 + resina 0,15 + celulose 0,035 + carbonato 0,005 + 1 embalagem; Interna Plus (a mais barata, SEM resina) → areia 11,97 + cimento 3,00 + celulose 0,03 + carbonato 0,005; Externa → areia 11,91 + cimento 3,00 + resina 0,05 + celulose 0,035; Gold → areia 11,28 + cimento 3,50 + resina 0,18. PREÇOS REAIS já apurados das notas de compra (NF-e, jan+fev+mar/2026): CIMENTO CP V ARI granel R$ 495/t = R$ 0,495/kg — preço FIRME, confirmado em TRÊS meses seguidos (jan 565,95 t + fev 340,46 t + mar 113,64 t, sempre R$ 495/t); EMBALAGEM saco valvulado R$ 487/mil = R$ 0,487/saco; CELULOSE (kit celulose / éter de celulose HPMC / Maiancel 70) ≈ R$ 17/kg — CONFIRMADO em março por dois fornecedores (ADITEX HPMC 25 kg R$ 418,24 = R$ 16,73/kg; MAIAN Maiancel 70 R$ 17,11/kg); CARBONATO (calcário dolomítico #170) R$ 0,244–0,269/kg (jan R$ 244/t, mar R$ 269/t). Com isso, o custo JÁ CALCULÁVEL por saco (cimento + carbonato + embalagem + celulose) é R$ 2,82 no Master/Gold; R$ 2,48 na Interna Plus (que NÃO tem resina — falta SÓ a areia!); R$ 2,57 na Externa. Ranking de custo (dirigido por resina + cimento): Master/Gold/Piscina/Porcelanato Ext/Sobrepor = os mais caros; Interna Plus/Estrutural = os mais baratos. FALTAM só 3 preços: AREIA (produção própria da KALFIX: draga + secagem no forno — é custo de transferência, não nota de compra), KIT RESINA (RDP/polímero — fornecedor Viapol aparece, mas o preço/kg ainda não saiu limpo) e INCORPORADOR DE AR (só no Multiuso). Enquanto não chegam, ficam DADO A CONFIRMAR. Cruzamento com o top-down (matéria-prima R$ 2,78/saco médio): com celulose agora dentro, sobra pouco para areia + resina — coerente. Origem: extração fiscal de compras jan+fev+mar/2026 (Itens_Produtos) + aba Materiais (receita).',q:'Mostre o modelo de custo por produto (bottom-up): a receita por saco de cada argamassa, os preços reais já apurados (cimento R$ 0,495/kg, embalagem R$ 0,487, celulose ~R$ 17/kg, carbonato ~R$ 0,25/kg), o custo já calculável por saco (Interna Plus R$ 2,48, só falta areia) e os 3 insumos que faltam (areia, resina, incorporador).'},
          {t:'oport',tp:'Compras',tt:'COMPRAS · avaliação por fornecedor (jan+fev/2026, extração fiscal item a item). Compras de produto: jan R$ 525,3 mil, fev R$ 605,2 mil. O CIMENTO (Companhia Industrial de Cimento · Apodi) é DISPARADO o maior fornecedor: R$ 295,9 mil em jan (56% das compras) e R$ 206,1 mil em fev (34%) — 906 t em dois meses ao MESMO preço firme de R$ 495/t. Avaliação: (1) alta CONCENTRAÇÃO num único fornecedor de cimento limita barganha e cria risco de fornecimento — avaliar 2º fornecedor e contrato de suprimento; (2) o preço não caiu apesar do volume alto — há ESCALA a capturar (negociar desconto por volume). Embalagem (saco valvulado) vem de DOIS fornecedores concorrentes (Poli-Gyn e Renovar) a R$ 0,487/saco — concorrência saudável, manter. Energia saltou de R$ 24,7 mil (jan) para R$ 55,2 mil (fev) — auditar antes de virar tendência. Aditivos de celulose/resina (TOS Químicos · Maiancel; Plaster · Rocarcelo) já identificados, mas o preço por kg ainda não saiu limpo — rastrear a próxima nota deles fecha o custo por saco.',q:'Como agente de Compras da SKAL, avalie os fornecedores de jan+fev: a concentração no cimento (Apodi, 34–56% das compras), a oportunidade de negociar desconto por volume, a concorrência na embalagem, o salto da energia, e o que falta para fechar o custo dos aditivos. Priorize por reais e aponte risco de fornecedor e alavanca de negociação.'},
          {t:'oport',tp:'Comercial',tt:'COMISSÕES DE REPRESENTANTES · julho/2026 (relatório TOTVS F.VEN.07, "Espelho Positivo" = comissão sobre o BAIXADO/recebido, não sobre o faturado). 7 representantes movimentaram R$ 2.189,4 mil baixados, gerando R$ 97.686,74 de comissão (média 4,46%). Por representante (baixado / comissão / %): Pedro Soares 859,2 mil / 42.960,13 / 5,0%; Klésio 371,7 mil / 13.943,23 / 3,75%; Juvêncio (Jurel) 359,5 mil / 15.330,76 / 4,26%; Franz 304,9 mil / 13.720,26 / 4,50%; G Representações 147,4 mil / 5.641,19 / 3,83%; Real Representações 112,8 mil / 5.076,33 / 4,50%; Expandir 33,8 mil / 1.014,84 / 3,0%. AVALIAÇÃO: (1) forte CONCENTRAÇÃO — Pedro Soares sozinho é 39% do baixado por representantes e os 3 maiores somam 73%: risco de dependência; (2) a % de comissão varia de 3% a 5% sem padrão claro — vale uma política única por faixa/produto; (3) o modelo "Espelho Positivo" (paga só sobre o recebido) é sadio — alinha o representante à cobrança. É a base para calcular a rentabilidade por representante quando cruzada com o custo por produto.',q:'Como agente Comercial da SKAL, avalie as comissões de julho por representante (base baixada R$ 2,19 mi, comissão R$ 97,7 mil = 4,46%): a concentração no Pedro Soares (39%), a dispersão da % de comissão (3% a 5%) e se vale padronizar a política. Cruze com a carteira de clientes por representante.'},
          {t:'crit',tp:'Paradas',tt:'A maior causa de parada da produção é a FALTA DE AREIA SECA (13 fichas · P0). A areia seca vem do forno: ele secou 15.139 t contra 17.983 t consumidas — não seca no ritmo do consumo, então a linha para por falta de areia. Depois vêm equipamento (rosca de cimento, ensacadeira, esteira), mão de obra e energia. Prioridade nº 1: destravar a secagem e o estoque de areia seca (capacidade do forno + estoque mínimo).',q:'Explique por que a maior parada da produção da SKAL é a falta de areia seca, a ligação com a capacidade do forno, e o que fazer para destravar.'},
          {t:'oport',tp:'Estratégia',tt:'Diagnóstico: o gargalo é ABASTECIMENTO DE AREIA SECA (13 paradas) + equipamento + sequência, não capacidade da linha. A areia seca vem do forno; se o forno não seca no ritmo do consumo (secou 15.139 t vs 17.983 t consumidas), a linha para. Destravar: aumentar capacidade/estoque de areia seca (forno) e garantir estoque mínimo. Mix concentrado (top 3 = 90%) pede produção por CAMPANHAS + SMED. Programa de 90 dias: capacidade de secagem + estoque de areia, ativos críticos, campanhas, captura digital de tempos/perdas, custeio padrão. Falta o custo unitário dos insumos para fechar o custo por saco.',q:'Explique o programa de 90 dias da produção da SKAL, começando por destravar o abastecimento de areia seca (forno).'},
          {t:'oport',tp:'Equipes',tt:'Desempenho de equipes (jan–jul): vazão por hora quase igual (Diurno 9,26 t/h · Noturno 9,32), mas o diurno é +7% em mão de obra (1,66 vs 1,55 t/colaborador-h) e o noturno é mais estável. Aproveitamento da jornada: 87,6% do melhor mês — há ~14% (3.165 t) de oportunidade sem ampliar carga horária, concentrada no diurno (opera a 84,2% do próprio benchmark). Meta inicial viável: +10% (~2.229 t).',q:'Analise o desempenho das equipes diurna e noturna e onde está a maior oportunidade de aproveitamento da jornada.'},
          {t:'crit',tp:'Gargalos',tt:'OS 5 PRINCIPAIS GARGALOS OPERACIONAIS DA SKAL (síntese do Vault — produção, forno, custos, equipes, paradas). 1) SECAGEM DE AREIA (forno) · P0 — maior causa de parada (13 fichas): o forno secou 15.139 t contra 17.983 t consumidas, não seca no ritmo do consumo e a linha para por falta de areia seca. É a restrição nº 1 de todo o sistema. 2) CONFIABILIDADE DE EQUIPAMENTO · P0/P1 — rosca de cimento, ensacadeira e esteira param sem preventiva nem sobressalentes; falta MTBF/MTTR. 3) DADO OPERACIONAL NÃO CONFIÁVEL · P1 — muitas fichas têm motivo de parada legível mas sem horário completo, e Qtd Paradas/Qtd Perda vêm em branco; o total de horas paradas apurado é um PISO, não o real. Sem medição não se gerencia. 4) CUSTO/MARGEM NÃO FECHADOS · P1 — o custo por saco já anda (cimento R$ 0,495/kg, embalagem R$ 0,487, carbonato R$ 0,244), mas faltam areia (produção própria), resina, celulose e incorporador; sem custo-padrão e reconciliação por OF não há controle de margem. 5) SEQUENCIAMENTO E APROVEITAMENTO DA JORNADA · P1 — mix concentrado (top 3 = 90%) com trocas frequentes, e gap de ~14% (3.165 t) entre o produzido e o melhor mês de cada turno (diurno a 84,2% do próprio benchmark). Governança das OFs (números reutilizados, IDs filhos, datas 2025×2026) é um risco transversal que contamina os 5. Sequência de ataque: destravar a areia seca primeiro (libera o sistema), depois confiabilidade de ativos, captura digital do dado, custo-padrão e campanhas+SMED.',q:'Quais são os cinco principais gargalos operacionais da SKAL hoje, em ordem de prioridade, e por onde começar a atacar?'}
        ],
        hoje:{decisoes:5,riscos:3,pendencias:8,oportunidades:5,
          det:{
            decisoes:'1) Registrar no imobilizado os R$ 3,76 mi de imóveis de permuta (conferir contra os R$ 7,37 mi de 2024 com a contabilidade).\n2) Decidir a nova permuta da Rivello (R$ 173,8 mil de dívida) — avaliar imóvel, matrícula e liquidez antes de aceitar.\n3) Acionar a régua de cobrança sobre os ~R$ 3,35 mi de recebíveis atrasados (jan–jul) — a maior alavanca de caixa.\n4) Provisionar o desembolso recorrente: folha no dia 03 (~R$ 152 mil) e tributos no dia 17 (~R$ 264 mil).\n5) Controlar a despesa operacional, que ainda come parte da margem (lição do DRE de 2024).',
            riscos:'1) Recebíveis atrasados (~R$ 3,35 mi) e dívida +90d (R$ 717,8 mil) com risco de perda se não recuperados.\n2) Imóveis de permuta (R$ 3,76 mi) possivelmente fora do imobilizado — ativo não contabilizado.\n3) Giro do 2º semestre depende de novo faturamento: a cauda de recebíveis em aberto esvazia em nov/dez.',
            pendencias:'1) Fechar o custo por produto: o modelo bottom-up está montado e 4 preços já saíram das notas de jan–mar — cimento R$ 0,495/kg, embalagem R$ 0,487/saco, celulose ~R$ 17/kg e carbonato ~R$ 0,25/kg; faltam só 3 — areia (produção própria da KALFIX, custo de transferência), kit resina (RDP) e incorporador de ar (só no Multiuso). A Interna Plus já está quase fechada: falta só a areia. Buscar resina/incorporador em outro mês ou direto no outro mês) — para chegar à margem por produto.\n2) Registrar os imóveis de permuta no imobilizado (confirmar com a contabilidade).\n3) Energia e manutenção do forno — para fechar o custo/tonelada total de produção.\n4) Preencher o óleo (início/fim do tanque) por turno no app do forno, para o consumo L/ton calcular sozinho.\n5) Preencher Qtd Paradas e Qtd Perda nas fichas de produção (para medir perda/rendimento).\n6) Corrigir governança das OFs (nº reutilizados 019731/019836; OF 020146 sem ID filho; data 2025×2026 na OF 020154).\n7) Ativar os agentes ainda vazios da SKAL: Estoque, Logística e Projetos.\n8) Alimentar as próximas empresas: QUIMIKA e, por fim, a empresa KALFIX.',
            oportunidades:'1) Recuperar os ~R$ 3,35 mi de recebíveis atrasados — maior alavanca de caixa do semestre.\n2) Posição líquida a realizar +R$ 1,72 mi + crédito livre BB Giro de R$ 400 mil = folga de capital de giro.\n3) As permutas se pagam com material (custo ~R$ 3,49/saco), não com caixa — bom para o giro; falta R$ 2,13 mi de material a entregar.\n4) Crédito Presumido de 80% (Lei6.146/11) sustenta o ICMS (abate ~R$ 383 mil/mês) — manter a habilitação em dia.\n5) Areia fora do Imposto Seletivo na reforma + Fundo de Compensação de ICMS (habilitação até 2032).'
          }
        },
        nota:'Inadimplência: dados REAIS (ACOMPCOB 24/08, base desde 01/08/2021). Caixa: posição BB + CEF de 25/08 (R$ 651,2 mil). Nenhuma ação de alto impacto sem sua autorização.',
        graf:[
          {tipo:'bars2',tit:'Receita × Lucro líquido',unid:'R$ milhões · 2023–2025',
           cats:['2023','2024','2025'],
           series:[{nome:'Receita',cor:'#2dff8c',vals:[24.68,30.46,33.86]},{nome:'Lucro',cor:'#d4b26a',vals:[4.08,1.32,2.86]}],
           q:'Analise a trajetória de receita e lucro líquido da SKAL de 2023 a 2025 (Receita 24,68 → 30,46 → 33,86 mi; Lucro 4,08 → 1,32 → 2,86 mi): o que explica a queda de lucro em 2024 e a recuperação em 2025, o que está acontecendo com a margem, e projete 2026.'},
          {tipo:'donut',tit:'Inadimplência por idade',unid:'R$ 832,8 mil · total',
           partes:[{nome:'0–30 dias',val:115.31,cor:'#2dff8c'},{nome:'30–90 dias',val:77.06,cor:'#e6c15a'},{nome:'+90 dias',val:640.38,cor:'#ff5b6e'}],
           q:'Analise a composição por idade da inadimplência da SKAL em 14/08 (0–30: R$ 75,4 mil; 31–60: R$ 70,6 mil; 61–90: R$ 17,6 mil; +90 dias: R$ 717,8 mil, 81,4% do total de R$ 881,5 mil). Tirando os 3 casos especiais completos (MRV 94,9 mil, Vanguarda 49,3 mil, Rivello 173,8 mil), a inadimplência operacional é R$ 563,5 mil (faixas líquidas: 0–30 49,4; 31–60 66,3; 61–90 6,1; +90 441,7). Explique e dê a estratégia por faixa.'},
          {tipo:'bars2',tit:'Faturamento mensal 2026',unid:'R$ milhões · líquido (ago parcial)',cats:['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago*'],
           series:[{nome:'Faturamento',cor:'#2dff8c',vals:[2.08,1.87,2.35,1.90,1.89,2.34,2.39,0.81]}],
           q:'Analise o faturamento mensal da SKAL em 2026 (jan 2,08; fev 1,87; mar 2,35; abr 1,90; mai 1,89; jun 2,34; jul 2,39 mi; ago parcial). Compare com a média de 2025 (2,12 mi/mês) e diga se o ano está acelerando, estável ou desacelerando, e projete o fechamento de 2026.'},
          {tipo:'bars2',tit:'Compras por centro de custo 2025',unid:'R$ milhões · ano',cats:['Mat-Prima','Admin','Embal.','Prod SKAL','Forno'],
           series:[{nome:'Compras',cor:'#e6c15a',vals:[8.53,4.05,2.66,2.61,0.96]}],
           q:'Analise as compras da SKAL por centro de custo em 2025 (Matéria-Prima 8,53 mi, Administrativo 4,05, Embalagens 2,66, Produção SKAL 2,61, Forno 0,96): onde está o maior gasto, o que é custo variável de produção, e onde há espaço para negociação com fornecedores.'},
          {tipo:'bars2',tit:'Fechamento de caixa · Agosto/2026',unid:'R$ mil · entradas × saídas do mês',cats:['Entradas','Saídas'],
           series:[{nome:'Agosto',cor:'#2dff8c',vals:[2260.2,1663.6]}],
           q:'Apresente o FECHAMENTO DE CAIXA de agosto/2026 da SKAL. ENTRADAS (a receber do mês): R$ 2.260,2 mil. SAÍDAS: fornecedores (contas a pagar em aberto do mês) R$ 1.177,5 mil + folha R$ 152,3 mil (dia 03) + tributos estaduais R$ 263,8 mil (dia 17) + encargos INSS/FGTS ~R$ 70,0 mil (~dia 20) = R$ 1.663,6 mil. RESULTADO DO MÊS: +R$ 596,6 mil. Caixa inicial ~R$ 827,3 mil (ref. 24/07) → caixa projetado no fim de agosto ~R$ 1.423,9 mil (mais crédito livre BB Giro R$ 400 mil de folga). Faça o quadro Fato/Interpretação/Recomendação, aponte que a folha (dia 03) e os tributos (dia 17) já saíram, e conclua a saúde do caixa de agosto e o que observar em setembro.'},
          {tipo:'fluxo',tit:'Fluxo de caixa projetado',unid:'R$ mil · saldo acumulado (cenário conservador)',
           meses:['17/08','Ago','Set','Out','Nov','Dez'],
           saldo:[584.8,1001.7,1699.6,1395.4,796.7,123.6],
           linhas:[['Ago',1381.4,964.5,416.9,1001.7],['Set',1763.7,1065.8,697.9,1699.6],['Out',492.1,796.3,-304.2,1395.4],['Nov',128.1,726.8,-598.7,796.7],['Dez',7.9,681.0,-673.1,123.6]],
           q:'Apresente a PREVISÃO DE FLUXO DE CAIXA da SKAL como um demonstrativo profissional, mês a mês (agosto a dezembro/2026), com saldo inicial, entradas, saídas e SALDO ACUMULADO. Saldo inicial ~R$ 827,3 mil (caixa BB, ref. 24/07). Entradas = recebíveis em aberto (Ago 1.381,4; Set 1.763,7; Out 492,1; Nov 128,1; Dez 7,9 mil). Saídas = fornecedores + folha (dia 03, ~152,3) + tributos (dia 17, ~264) + encargos (~dia 20, ~70), aplicando a regra de que contas a pagar até o dia 17 já foram pagas: Ago 964,5; Set 1.065,8; Out 796,3; Nov 726,8; Dez 681,0 mil. Saldo acumulado projetado: Ago 1.244,2; Set 1.942,1; Out 1.637,9; Nov 1.039,2; Dez 366,1 mil (mais R$ 400 mil de crédito livre BB Giro de reserva). PREMISSA: cenário CONSERVADOR — só a carteira atual, sem novo faturamento; por isso out-dez ficam negativos no mês (a cauda de recebíveis esvazia). Interprete a saúde do caixa, o mês de maior aperto, e recomende. Deixe claro que novas vendas melhoram out-dez.'},
          {tipo:'bars2',tit:'Permutas · valor do imóvel × saldo a entregar',unid:'R$ mil · material a compensar',cats:['Rivello','Vanguar.','Gávea','Boa Vis.','Triunfo','F.Melo','Macedo','Nailson'],
           series:[{nome:'Valor imóvel',cor:'#2dff8c',vals:[764.1,735.6,680.0,524.9,519.4,220.0,211.1,100.0]},{nome:'Saldo a entregar',cor:'#ff5b6e',vals:[340.9,408.6,425.1,135.4,519.4,220.0,211.1,100.0]}],
           q:'Analise a reconciliação das permutas da SKAL (planilha PERMUTA_SALDO). Regra: o material entregue conta como permuta ATÉ FECHAR O VALOR DO IMÓVEL; o que passar disso é venda normal. Valor total dos imóveis (contratos): R$ 3.755.211,18; já compensado com material: R$ 1.629.390 (43%); SALDO de material ainda a entregar: R$ 2.125.821 — isso é obrigação FUTURA de material, não caixa. Por permuta (valor / saldo a entregar): Rivello 764.146 / 340.880; Vanguarda 735.636 / 408.624; Gávea 680.000 / 425.147 (pela planilha de faturamento — Encontro de Contas 16.09 — só R$ 254.853 foram compensados; a Gávea NÃO está quitada, ao contrário do que a PERMUTA_SALDO indicava); Boa Vista 524.900 / 135.400; Triunfo 519.425 / 519.425 (ainda não iniciada); Felipe Melo 220.000 / 220.000; Macedo Fortes 211.104 / 211.104; Nailson Nortecor 100.000 / 100.000. Interprete: quais permutas estão perto de fechar, quanto de material ainda sai do estoque (custo, não dinheiro), e o que registrar no imobilizado (os R$ 3,76 mi de imóveis).'},
          {tipo:'bars2',tit:'Compras por fornecedor · Janeiro',unid:'R$ mil · produtos (jan/2026)',cats:['Cimento','Plaster','N.Minas','Poli-Gyn','Inove','Renovar'],
           series:[{nome:'Compras',cor:'#e6c15a',vals:[295.9,42.2,31.1,29.6,29.0,27.2]}],
           q:'Analise a concentração de fornecedores da SKAL em janeiro (compras de produto R$ 525,3 mil): o cimento (Companhia Industrial de Cimento · Apodi) sozinho é R$ 295,9 mil (56%). Explique o risco de dependência de um único fornecedor de cimento, a oportunidade de negociar desconto por volume (906 t em jan+fev ao mesmo R$ 495/t), e a saúde da concorrência na embalagem (Poli-Gyn + Renovar). Priorize por reais.'},
          {tipo:'bars2',tit:'Faturamento por representante · Julho',unid:'R$ mil · baixado (jul/2026)',cats:['Pedro S.','Klésio','Juvêncio','Franz','G Rep.','Real','Expandir'],
           series:[{nome:'Baixado',cor:'#57b6ff',vals:[859.2,371.7,359.5,304.9,147.4,112.8,33.8]}],
           q:'Analise a carteira de representantes da SKAL em julho (base baixada R$ 2,19 mi, comissão R$ 97,7 mil = 4,46% médio): Pedro Soares sozinho é R$ 859,2 mil (39% do total, comissão 5%); os três maiores (Pedro, Klésio, Juvêncio) somam 73%. Explique a concentração no Pedro Soares, o risco de dependência de um representante, e a dispersão de comissão (3% a 5%) — vale padronizar? Priorize por reais.'}
        ],
        entradas:{data:'24/08 · fluxo',
          cards:[['Faturamento do dia','R$ 147,4 mil','ok'],['Entrou em conta','R$ 249,0 mil','ok'],['Resgatado','R$ 14,0 mil','ok'],['Ficou em atraso','R$ 33,0 mil','crit']],
          graf:{tipo:'bars2',tit:'Previsão de entrada · 26/08–01/09',unid:'R$ mil',cats:['26/08','27/08','28/08','31/08','01/09'],
            series:[{nome:'Previsto',cor:'#57b6ff',vals:[83.45,71.12,73.53,115.67,175.38]}]},
          q:'Analise as entradas do dia 24/08 da SKAL (faturamento do dia R$ 147.388,04 — a vista Oficial 18.864,43, a vista NG 1.843,60, a prazo 126.680,01; entrou em conta R$ 248.972,05 = boletos 206.509,93 + depositos 42.462,12; previsto era 221.035,62; resgatado de inadimplencia R$ 14.036,46; ficou em atraso R$ 33.014,19 — alto) e a previsao de entrada de 26/08 a 01/09 (26/08 83.453,59; 27/08 71.119,77; 28/08 73.528,51; 31/08 115.668,85; 01/09 175.376,72; total 519.147,44). Destaque o dia 31/08 e 01/09 (que cobrem os vencimentos de tributos) e o que priorizar na cobranca.'},
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
  var isForno = false; try { isForno = new URL(req.url, 'http://x').searchParams.get('forno') === '1'; } catch(e) {}
  var users = parseUsers();
  var authed = !users || !!verify(tokenOf(req));
  if (users && !authed) { res.statusCode = 401; return res.end(JSON.stringify({ auth: true })); }
  // Modo FORNO: so os dados ao vivo do forno (rede). Carregado separado para NAO travar o painel.
  if (isForno) { res.statusCode = 200; return res.end(JSON.stringify({ auth: !!users, FORNO: await fetchForno() })); }
  // Modo painel: KPIs e cards saem NA HORA (buildData e sincrono, sem esperar rede). O forno vem depois.
  var u = users ? verify(tokenOf(req)) : null;
  res.statusCode = 200; return res.end(JSON.stringify({ auth: !!users, user: u || undefined, payload: buildData() }));
};

// Exporta as funcoes para o cerebro (api/chat.js) usar a MESMA fonte de dados do painel.
module.exports.buildData = buildData;
module.exports.fetchForno = fetchForno;
module.exports.payloadWithForno = payloadWithForno;
