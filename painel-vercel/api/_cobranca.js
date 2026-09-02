// _cobranca.js — carteira a receber POR CLIENTE + posição de inadimplência, para a
// cadeira de Cobrança analisar maus pagadores / clientes críticos com NOME e NÚMERO
// real, em vez de repetir agregado.
//
// DUAS fontes, DUAS datas (não confundir):
//  (A) POSIÇÃO/AGING — ACOMPCOB de 31/08/2026 (relatório diário, o mais recente).
//      Traz o aging e os 3 casos especiais nomeados; NÃO itemiza o +90 pulverizado.
//  (B) CARTEIRA POR CLIENTE — snapshot de 27/07/2026 (radar/dashboard...xlsx,
//      abas "Inadimplência ERP"/"Contrapartes"): TOP 20 devedores com NOME e vencido.
// O +90 pulverizado completo (todos os pequenos) exige o relatório ANALÍTICO por
// cliente do TOTVS — não vem no ACOMPCOB diário nem no top-20.
'use strict';

// ---------- (A) POSIÇÃO — ACOMPCOB 31/08/2026 ----------
var CORTE_POS = '31/08/2026';
var TOTAL = 809620.43;                 // saldo devedores 01/08/2021 a 31/08/2026
// Aging (faixa, saldo, dos quais dos 3 casos, operacional = tirando os 3 casos).
var AGING = [
  { faixa:'0-30 dias',   saldo:66163.99,  casos:27664.30, operacional:38499.79 },  // MRV 20.688,30 + Rivello 6.976
  { faixa:'31-60 dias',  saldo:87732.30,  casos:4368.00,  operacional:73364.30 },  // Rivello 4.368
  { faixa:'61-90 dias',  saldo:15342.35,  casos:0,        operacional:15342.35 },
  { faixa:'+90 dias',    saldo:640381.79, casos:287589.26,operacional:352792.53 }  // Vanguarda 49.340 + MRV 74.175 + Rivello 164.074,26
];
var OPERACIONAL = 479998.97;           // inadimplência operacional (tirando os 3 casos): soma das faixas "operacional"

// 3 casos especiais (fora do padrão — tratar à parte, NÃO como régua de cobrança comum).
var CASOS = [
  { cliente:'MRV',       total:94863.30,  mais90:74175.00, nota:'em cobrança judicial, dentro do previsto' },
  { cliente:'Vanguarda', total:49340.00,  mais90:49340.00, nota:'ligada a permuta em andamento (Studio V)' },
  { cliente:'Rivello',   total:175418.26, mais90:164074.26,nota:'quer NOVA PERMUTA — decisão de alto impacto pendente da diretoria; permuta não é caixa' }
];

// ---------- (B) CARTEIRA POR CLIENTE — snapshot 27/07/2026 ----------
var CORTE_CART = '27/07/2026';
var TOP = [
  { cliente:'F. A. Lima Extração de Areia - ME',                         aberto:285281.55, vencido:285281.55, docs:58 },
  { cliente:'C. C. de Vasconcelos - EPP',                                aberto:193079.92, vencido:6307.00,   docs:31 },
  { cliente:'MRV Engenharia e Participaçoes SA',                         aberto:125153.10, vencido:63596.70,  docs:12 },
  { cliente:'Construtora e Imobiliária Triunfo Ltda ME',                 aberto:113384.10, vencido:83349.78,  docs:51 },
  { cliente:'Construmoveis Comércio de Móveis e Eletrodomésticos LTDA',  aberto:89404.00,  vencido:0.00,      docs:10 },
  { cliente:'KALFIX Indústria, Comércio e Engenharia Ltda EPP',          aberto:78061.66,  vencido:0.00,      docs:27 },
  { cliente:'GM Construções Ltda. ME',                                   aberto:74282.73,  vencido:41531.88,  docs:5 },
  { cliente:'Piaui Materiais de Construçoes LTDA',                       aberto:68445.63,  vencido:0.00,      docs:7 },
  { cliente:'TECNIKA Construção e Serviço de Engenharia EIRELI',         aberto:67040.04,  vencido:67040.04,  docs:15 },
  { cliente:'M. T. Pereira Cunha Gomes - ME',                            aberto:62031.40,  vencido:0.00,      docs:17 },
  { cliente:'Vasconcelos e Mendes Ltda EPP',                             aberto:61648.04,  vencido:0.00,      docs:10 },
  { cliente:'Macedo Fortes Empreendimentos Ltda. EPP',                   aberto:60065.23,  vencido:13365.75,  docs:14 },
  { cliente:'ENGIPEC - Comércio Ltda',                                   aberto:54621.12,  vencido:0.00,      docs:15 },
  { cliente:'LB Comércio de Material de Construção Ltda EPP',            aberto:54455.33,  vencido:0.00,      docs:5 },
  { cliente:'Deilany Michelle Costa Palmeira',                           aberto:54441.64,  vencido:54441.64,  docs:28 },
  { cliente:'A. C. Ferreira da Cruz',                                    aberto:54124.24,  vencido:0.00,      docs:9 },
  { cliente:'Piaui Materiais De Construções LTDA',                       aberto:50555.09,  vencido:0.00,      docs:5 },
  { cliente:'Vanguarda Engenharia Ltda.',                                aberto:49340.00,  vencido:49340.00,  docs:15 },
  { cliente:'Jorge Guilherme Costa Ferreira',                            aberto:47600.00,  vencido:47600.00,  docs:34 },
  { cliente:'J. B. Pinto Neto Materiais e Construçoes',                  aberto:47197.00,  vencido:0.00,      docs:15 }
];

// Reconciliações de dono (para NÃO ler intragrupo/sócio como mau pagador de mercado).
var NOTAS = [
  'KALFIX (R$ 78,1k, 0 vencido) é COLIGADA do grupo — intragrupo, não mau pagador de mercado.',
  'Jorge Guilherme Costa Ferreira (R$ 47,6k, 100% vencido) é o SÓCIO — conta de sócio, tratar à parte, não inadimplência de cliente.',
  'F. A. Lima Extração de Areia (R$ 285,3k, 100% vencido) é TAMBÉM FORNECEDOR de areia (~R$ 108k a pagar) — cabe ENCONTRO DE CONTAS / permuta, não só cobrança.'
];

function mil(n){
  if (n >= 1000000) return 'R$ ' + (Math.round(n/10000)/100).toLocaleString('pt-BR') + ' mi';
  return 'R$ ' + (Math.round(n/100)/10).toLocaleString('pt-BR') + 'k';
}

// Bloco de texto para o contexto do Conselho/chat (a cadeira de Cobrança usa; as outras ignoram).
function bloco(){
  var L = [];
  L.push('COBRANÇA — POSIÇÃO ATUAL (ACOMPCOB '+CORTE_POS+') — use SÓ na cadeira de Cobrança:');
  L.push('Inadimplência total '+mil(TOTAL)+'. Aging (faixa | saldo | operacional s/ os 3 casos): ' +
    AGING.map(function(a){ return a.faixa+' '+mil(a.saldo)+' (op '+mil(a.operacional)+')'; }).join('; ') + '.');
  L.push('3 CASOS ESPECIAIS (tratar à parte, não régua comum): ' +
    CASOS.map(function(c){ return c.cliente+' '+mil(c.total)+' ('+c.nota+')'; }).join('; ') + '.');
  L.push('Inadimplência OPERACIONAL (tirando os 3 casos) = '+mil(OPERACIONAL)+' — é aqui que a régua D-5..D90 foca.');
  L.push('ATENÇÃO: o +90 (op '+mil(352792.53)+') é PULVERIZADO em muitos devedores pequenos — este relatório NÃO os itemiza. Para nomear todos, exportar o relatório ANALÍTICO por cliente do TOTVS (cliente, título, vencimento, valor, faixa).');
  L.push('');
  L.push('CARTEIRA A RECEBER POR CLIENTE (snapshot '+CORTE_CART+' — o "quem", top-20 por saldo):');
  L.push('(aberto | vencido | %vencido | docs) — %vencido alto = mau pagador:');
  TOP.forEach(function(c){
    var pv = c.aberto>0 ? Math.round(c.vencido/c.aberto*100) : 0;
    var flag = pv>=80 ? '  <= CRÍTICO' : (pv>=40 ? '  <= atenção' : '');
    L.push('- '+c.cliente+': '+mil(c.aberto)+' | venc '+mil(c.vencido)+' | '+pv+'% | '+c.docs+' docs'+flag);
  });
  L.push('RECONCILIAÇÃO (não confundir): ' + NOTAS.join(' '));
  return L.join('\n');
}

module.exports = { CORTE_POS:CORTE_POS, CORTE_CART:CORTE_CART, TOTAL:TOTAL, AGING:AGING,
  OPERACIONAL:OPERACIONAL, CASOS:CASOS, TOP:TOP, NOTAS:NOTAS, bloco:bloco };
