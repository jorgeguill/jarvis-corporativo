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

function buildData(){
    var DATA={
      SKAL:{nome:'SKAL Engenharia',status:'aten',dados:true,
        kpis:[
          {l:'Caixa',v:'R$ 827,3 mil',st:'ok'},
          {l:'A Receber',v:'R$ 1,84 mi',st:'aten'},
          {l:'Inadimplência',v:'R$ 852,3 mil',st:'crit'},
          {l:'Lucro 2025',v:'R$ 2,86 mi',st:'ok'}
        ],
        alertAgents:['cob'],
        alerta:{
          tit:'Dívida antiga e permutas distorcem o caixa real',
          txt:'Contas e impostos estão em dia. Os dois pontos que realmente pesam: a inadimplência acima de 90 dias soma R$ 670,4 mil (79% da dívida) e não está entrando dinheiro novo nela; e as permutas baixadas como dinheiro (Gávea R$ 251 mil) inflam caixa e faturamento — então o caixa real é menor do que o painel sugere. Cruzando Cobrança e Contábil, o foco é recuperar a dívida antiga e trazer os imóveis de permuta para o patrimônio.',
          chips:[['cob','Cobrança'],['comp','Contábil'],['fin','Financeiro']],
          q:'Como R.A.D.A.R. Estratégico, cruze a inadimplência antiga e as permutas da SKAL (lembrando que contas e impostos estão em dia): qual o efeito no caixa real e quais as 3 a 4 ações prioritárias com evidência?'
        },
        eventos:[
          {t:'crit',tp:'Crítico',tt:'Inadimplência acima de 90 dias em R$ 670,4 mil — 79% da dívida. O +90 SEGUROU (não cresceu vs 11/08), mas o total subiu para R$ 852,3 mil porque o 31–60 saltou +30,2 mil: dívida de médio prazo aumentando. Vigiar o 31–60 para não virar +90.',q:'Detalhe a inadimplência acima de 90 dias e o crescimento do 31–60, e o que fazer para recuperar.'},
          {t:'crit',tp:'Crítico',tt:'Permutas: R$ 251,1 mil (Gávea) baixados como dinheiro em caixa, mas a contrapartida foi imóvel. Risco de caixa inflado e imóvel fora do patrimônio.',q:'Explique o risco das permutas da Gávea e o que precisa ser corrigido.'},
          {t:'oport',tp:'Tendência',tt:'Lucro líquido: R$ 4,08 mi (2023) → R$ 1,32 mi (2024, ano de aperto por despesa) → R$ 2,86 mi (2025, recuperou). Receita cresce todo ano (R$ 33,86 mi em 2025). O foco de gestão é a despesa operacional, que ainda come boa parte da margem.',q:'Como está a trajetória de lucro e margem da SKAL e o que controlar?'},
          {t:'aten',tp:'Atenção',tt:'Patrimônio (Balanço 2024): imobilizado de R$ 7,37 mi cresceu R$ 1,1 mi no ano. Confirmar com a contabilidade se os imóveis de permuta estão registrados aí.',q:'Os imóveis de permuta estão no imobilizado do balanço de 2024?'},
          {t:'oport',tp:'Em dia',tt:'Contas e impostos em dia (confirmado pela diretoria). O que aparecia como "vencido" no relatório de 24/07 — R$ 1,29 mi, incluindo R$ 274 mil da Receita — eram contas já pagas e não baixadas no sistema. Não é atraso, é a mesma lição da baixa não lançada.',q:'As contas a pagar e os impostos da SKAL estão em atraso?'},
          {t:'oport',tp:'Oportunidade',tt:'Crédito livre no BB Giro de ~R$ 400 mil não utilizado — folga para capital de giro sem tomar dívida cara.',q:'Como usar melhor o crédito livre do BB Giro?'},
          {t:'prev',tp:'Previsão',tt:'Reforma tributária: a AREIA ficou FORA do Imposto Seletivo. Incentivos de ICMS valem até 2032 (com Fundo de Compensação para quem se habilitar).',q:'O que a reforma tributária muda para a SKAL nos próximos anos?'},
          {t:'oport',tp:'Positivo',tt:'2º trimestre de 2026 foi lucrativo (base R$ 982,8 mil). Mas IRPJ + CSLL somaram ~R$ 328 mil no trimestre (Lucro Real) — vale avaliar planejamento tributário.',q:'Como reduzir a carga de IRPJ e CSLL da SKAL no Lucro Real?'},
          {t:'prev',tp:'Vencimento',tt:'Taxa de Localização de Parnaíba (R$ 660,83) vence em 22/08. Licença Ambiental (matriz) e Bombeiros (Parnaíba) válidos até 2027.',q:'Quais documentos e taxas da SKAL estão vencendo?'},
          {t:'oport',tp:'Produção',tt:'Produção de argamassa (marca Kalfix, empresa SKAL) — Banco Mestre REV4: 1,54 mi de sacos em jan–ago/2026 (23.172 t, 1.316 ordens). Picos em março (244,6k) e junho (244,8k). Mix: Master 38%, Interna Plus 27%, Externa 25%, Gold 7%. Consumo: Areia 17.983 t, Cimento 4.999 t.',q:'Analise a produção de argamassa da SKAL em jan–ago: volume, mix, turno e tendência.'},
          {t:'aten',tp:'Paradas',tt:'Paradas auditadas (63 revisadas): a FALTA DE ÁGUA domina a indisponibilidade (P0), seguida de equipamento (rosca de cimento, ensacadeira, esteira). O total auditado é um piso — muitos registros têm motivo mas sem horário. Prioridade: tornar código, início, fim, responsável e impacto de cada parada obrigatórios.',q:'Quais as principais causas de parada na produção da SKAL e como reduzir a indisponibilidade?'},
          {t:'oport',tp:'Estratégia',tt:'Diagnóstico: gargalo é disponibilidade (água/equipamento) + sequência, não capacidade. Mix concentrado (top 3 = 90%) pede produção por CAMPANHAS + SMED. Recomendado: programa de 90 dias (estabilizar utilidades, campanhas, captura digital de tempos/perdas, custeio padrão). Falta o custo unitário dos insumos para fechar o custo por saco.',q:'Explique o programa de 90 dias recomendado para a produção da SKAL e por onde começar.'}
        ],
        hoje:{decisoes:5,riscos:3,pendencias:8,oportunidades:4,
          det:{
            decisoes:'1) Acionar a régua de cobrança sobre os R$ 670,4 mil vencidos +90d.\n2) Levantar e registrar no patrimônio os imóveis de permuta (Gávea R$ 251,1 mil).\n3) Reconciliar o "recebido" do ERP contra o extrato de junho.\n4) Garantir a baixa no sistema das contas já pagas, para o relatório parar de mostrar "vencido".\n5) Controlar a despesa operacional, que ainda consome parte da margem (lição do DRE).',
            riscos:'1) Dívida antiga (+90d) com risco real de perda.\n2) Caixa-fantasma das permutas inflando caixa e resultado.\n3) Baixas não lançadas distorcem o painel (contas já pagas aparecem como vencidas).',
            pendencias:'1) Custo unitário dos insumos (areia, cimento, resina, embalagens) — fecha o custo por saco e a margem por produto.\n2) Ler contratos de permuta escaneados (Macedo Fortes, Franklin Chakal, Village do Sol).\n3) Cadastrar os contratos de permuta e registrar os imóveis no patrimônio (confirmar com a contabilidade).\n4) Corrigir na origem a soma MRV+Vanguarda do ACOMPCOB (diferença fixa de R$ 4.698: o certo é 146.167,40).\n5) Atualizar caixa e A Receber (referência ainda de 24/07).\n6) Preencher Qtd Paradas e Qtd Perda nas fichas de produção (para medir perda/rendimento).\n7) Corrigir governança das OFs (nº reutilizados 019731/019836; OF 020146 sem ID filho; data 2025×2026 na OF 020154).\n8) Ativar os agentes ainda vazios da SKAL: Estoque, Logística e Projetos.',
            oportunidades:'1) BB Giro de R$ 400 mil livre para capital de giro.\n2) Areia fora do Imposto Seletivo na reforma.\n3) Recuperar 0–30 (R$ 96,2 mil) e conter o 31–60 (R$ 68,2 mil, subiu +30 mil).\n4) Fundo de Compensação de ICMS (habilitação).'
          }
        },
        nota:'Inadimplência: dados REAIS (ACOMPCOB 12/08). Caixa/A Receber referência de 24/07. Nenhuma ação de alto impacto sem sua autorização.',
        graf:[
          {tipo:'bars2',tit:'Receita × Lucro líquido',unid:'R$ milhões · 2023–2025',
           cats:['2023','2024','2025'],
           series:[{nome:'Receita',cor:'#2dff8c',vals:[24.68,30.46,33.86]},{nome:'Lucro',cor:'#d4b26a',vals:[4.08,1.32,2.86]}],
           q:'Analise a trajetória de receita e lucro líquido da SKAL de 2023 a 2025 (Receita 24,68 → 30,46 → 33,86 mi; Lucro 4,08 → 1,32 → 2,86 mi): o que explica a queda de lucro em 2024 e a recuperação em 2025, o que está acontecendo com a margem, e projete 2026.'},
          {tipo:'donut',tit:'Inadimplência por idade',unid:'R$ 852,3 mil · total',
           partes:[{nome:'0–30 dias',val:96.17,cor:'#2dff8c'},{nome:'30–90 dias',val:85.78,cor:'#e6c15a'},{nome:'+90 dias',val:670.37,cor:'#ff5b6e'}],
           q:'Analise a composição por idade da inadimplência da SKAL em 12/08 (0–30: R$ 96,2 mil; 31–60: R$ 68,2 mil; 61–90: R$ 17,6 mil; +90 dias: R$ 670,4 mil, 79% do total de R$ 852,3 mil): o +90 segurou mas o 31–60 saltou +30 mil; o que é recuperável, o risco de o 31–60 virar +90, e a estratégia por faixa.'},
          {tipo:'bars2',tit:'Faturamento mensal 2026',unid:'R$ milhões · líquido (ago parcial)',cats:['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago*'],
           series:[{nome:'Faturamento',cor:'#2dff8c',vals:[2.08,1.87,2.35,1.90,1.89,2.34,2.39,0.81]}],
           q:'Analise o faturamento mensal da SKAL em 2026 (jan 2,08; fev 1,87; mar 2,35; abr 1,90; mai 1,89; jun 2,34; jul 2,39 mi; ago parcial). Compare com a média de 2025 (2,12 mi/mês) e diga se o ano está acelerando, estável ou desacelerando, e projete o fechamento de 2026.'},
          {tipo:'bars2',tit:'Compras por centro de custo 2025',unid:'R$ milhões · ano',cats:['Mat-Prima','Admin','Embal.','Prod SKAL','Forno'],
           series:[{nome:'Compras',cor:'#e6c15a',vals:[8.53,4.05,2.66,2.61,0.96]}],
           q:'Analise as compras da SKAL por centro de custo em 2025 (Matéria-Prima 8,53 mi, Administrativo 4,05, Embalagens 2,66, Produção SKAL 2,61, Forno 0,96): onde está o maior gasto, o que é custo variável de produção, e onde há espaço para negociação com fornecedores.'}
        ],
        entradas:{data:'12/08 · fluxo',
          cards:[['Faturamento do dia','R$ 182,5 mil','ok'],['Resgatado','R$ 5,1 mil','ok'],['Venceu no dia','R$ 23,5 mil','aten'],['Previsão 14–20/08','R$ 471,1 mil','oport']],
          graf:{tipo:'bars2',tit:'Previsão de entrada · 14–20/08',unid:'R$ mil',cats:['14/08','17/08','18/08','19/08','20/08'],
            series:[{nome:'Previsto',cor:'#57b6ff',vals:[43.51,76.74,190.98,85.32,74.60]}]},
          q:'Analise as entradas do dia 12/08 da SKAL (faturamento do dia R$ 182.501,83 — à vista NFe 13.042,90, NG 11.792,40, a prazo 157.666,53; resgatado de inadimplência R$ 5.122,00; venceu e não pagou R$ 23.547,71, valor alto) e a previsão de entrada de 14 a 20/08 (14/08 43.509,28; 17/08 76.735,81; 18/08 190.978,10; 19/08 85.317,03; 20/08 74.599,80; total 471.140,02). O que isso diz sobre o fluxo de caixa da semana, considerando a folha mensal (~124 mil líquido) e as saídas recorrentes, e o que priorizar na cobrança e no caixa?'},
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
             q:'Analise o consumo de insumos da produção da SKAL em jan–ago (Areia 17.983 t, Cimento 4.999 t, Resina 130,8 t, Celulose 51,6 t) e o que falta para fechar o custo por saco.'}
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
      var fiscal={tipo:'bars2',tit:'Tributos · 2º tri/2026',unid:'R$ mil · Lucro Real',cats:['IRPJ','Adic.10%','CSLL'],
        series:[{nome:'Apurado',cor:'#57b6ff',vals:[147.43,92.28,88.46]}],
        q:'Analise a carga de IRPJ (147,43 mil), adicional de 10% (92,28 mil) e CSLL (88,46 mil) apurados no 2º trimestre de 2026 da SKAL (Lucro Real, base 982,8 mil): peso sobre o resultado e caminhos de planejamento tributário lícito.'};
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

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-radar-auth');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  var users = parseUsers();
  if (!users) { res.statusCode = 200; return res.end(JSON.stringify({ auth: false, payload: buildData() })); }
  var u = verify(tokenOf(req));
  if (!u) { res.statusCode = 401; return res.end(JSON.stringify({ auth: true })); }
  res.statusCode = 200; return res.end(JSON.stringify({ auth: true, user: u, payload: buildData() }));
};
