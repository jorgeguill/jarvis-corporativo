// _cobranca.js — inadimplência da SKAL: SÉRIE no tempo (ACOMPCOB diário) + carteira
// a receber POR CLIENTE (snapshot), para a cadeira de Cobrança ler TENDÊNCIA e
// nomear críticos, em vez de repetir um número solto.
//
// FONTES / DATAS (não confundir):
//  (A) SÉRIE ACOMPCOB — retratos diários (o relatório traz aging + 3 casos, NÃO
//      itemiza o +90 pulverizado). Cada dia que o Jorge manda entra em HIST.
//  (B) CARTEIRA POR CLIENTE — snapshot 27/07/2026 (radar/dashboard...xlsx): TOP 20
//      devedores com NOME e vencido. O "quem".
// O +90 pulverizado completo (todos os pequenos) exige o relatório ANALÍTICO por
// cliente do TOTVS — não vem no ACOMPCOB diário nem no top-20.
'use strict';

// ---------- (A) SÉRIE — ACOMPCOB (mais recente por último) ----------
// data, total, e as 4 faixas do aging (0-30, 31-60, 61-90, +90). Reconciliam: soma = total.
var HIST = [
  { data:'26/08/2026', total:797494.81, f0_30:61862.71, f31_60:82740.46, f61_90:12509.85, f90:640381.79 },
  { data:'31/08/2026', total:809620.43, f0_30:66163.99, f31_60:87732.30, f61_90:15342.35, f90:640381.79 },
  { data:'01/09/2026', total:825130.89, f0_30:81674.45, f31_60:87732.30, f61_90:15342.35, f90:640381.79 }
];
var HOJE = HIST[HIST.length-1];
var ANT  = HIST.length>1 ? HIST[HIST.length-2] : null;

// 3 casos especiais (tratar à parte — NÃO régua comum). Valores em 01/09.
var CASOS = [
  { cliente:'MRV',       total:94863.30,  mais90:74175.00,  nota:'em cobrança judicial, dentro do previsto (R$ 20.688,30 no 0-30 é recente/normal)' },
  { cliente:'Vanguarda', total:49340.00,  mais90:49340.00,  nota:'ligada a permuta em andamento (Studio V)' },
  { cliente:'Rivello',   total:175418.26, mais90:164074.26, nota:'quer NOVA PERMUTA — decisão de alto impacto pendente da diretoria; permuta não é caixa' }
];
// Operacional (tirando os 3 casos): o relatório traz R$ 526.197,63 (total − 298.933,26).
// Há pequena inconsistência nas subtrações por faixa do relatório — DADO A CONFIRMAR o corte exato.
var OPERACIONAL_RELATORIO = 526197.63;

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
var NOTAS = [
  'KALFIX (R$ 78,1k, 0 vencido) é COLIGADA do grupo — intragrupo, não mau pagador de mercado.',
  'Jorge Guilherme Costa Ferreira (R$ 47,6k, 100% vencido) é o SÓCIO — conta de sócio, tratar à parte, não inadimplência de cliente.',
  'F. A. Lima Extração de Areia (R$ 285,3k, 100% vencido) é TAMBÉM FORNECEDOR de areia (~R$ 108k a pagar) — cabe ENCONTRO DE CONTAS / permuta, não só cobrança.'
];

function mil(n){
  var s = n<0 ? '-' : '';
  n = Math.abs(n);
  if (n >= 1000000) return s+'R$ ' + (Math.round(n/10000)/100).toLocaleString('pt-BR') + ' mi';
  return s+'R$ ' + (Math.round(n/100)/10).toLocaleString('pt-BR') + 'k';
}
function delta(a,b){ var d=a-b; return (d>=0?'+':'')+mil(d); }

function bloco(){
  var L = [];
  L.push('COBRANÇA — POSIÇÃO ATUAL (ACOMPCOB '+HOJE.data+') — use SÓ na cadeira de Cobrança:');
  L.push('Inadimplência total '+mil(HOJE.total)+'. Aging: 0-30 '+mil(HOJE.f0_30)+'; 31-60 '+mil(HOJE.f31_60)+'; 61-90 '+mil(HOJE.f61_90)+'; +90 '+mil(HOJE.f90)+'.');
  // Tendência (o valor da série)
  var serie = HIST.map(function(h){ return h.data.slice(0,5)+' '+mil(h.total); }).join(' → ');
  L.push('TENDÊNCIA ('+HIST.length+' retratos): '+serie+' ('+delta(HOJE.total,HIST[0].total)+' no período). '+
    'O aumento está no 0-30 ('+mil(HIST[0].f0_30)+' → '+mil(HOJE.f0_30)+', '+delta(HOJE.f0_30,HIST[0].f0_30)+') = NOVA inadimplência entrando; '+
    'o +90 está CONGELADO em '+mil(HOJE.f90)+' (dívida antiga não se move).' +
    (ANT ? ' No último dia: '+delta(HOJE.total,ANT.total)+' vs o retrato anterior.' : ''));
  L.push('3 CASOS ESPECIAIS (à parte, não régua comum): ' +
    CASOS.map(function(c){ return c.cliente+' '+mil(c.total)+' ('+c.nota+')'; }).join('; ') + '.');
  L.push('Inadimplência OPERACIONAL (tirando os 3 casos) ≈ '+mil(OPERACIONAL_RELATORIO)+' (relatório; pequena inconsistência nas subtrações por faixa — DADO A CONFIRMAR o corte exato). O +90 pulverizado ≈ '+mil(352792.53)+' NÃO está itemizado aqui — para nomear todos, exportar o relatório ANALÍTICO por cliente do TOTVS.');
  L.push('');
  L.push('CARTEIRA A RECEBER POR CLIENTE (snapshot '+CORTE_CART+' — o "quem", top-20 por saldo; aberto | vencido | %vencido | docs):');
  TOP.forEach(function(c){
    var pv = c.aberto>0 ? Math.round(c.vencido/c.aberto*100) : 0;
    var flag = pv>=80 ? '  <= CRÍTICO' : (pv>=40 ? '  <= atenção' : '');
    L.push('- '+c.cliente+': '+mil(c.aberto)+' | venc '+mil(c.vencido)+' | '+pv+'% | '+c.docs+' docs'+flag);
  });
  L.push('RECONCILIAÇÃO (não confundir): ' + NOTAS.join(' '));
  return L.join('\n');
}

module.exports = { HIST:HIST, HOJE:HOJE, CASOS:CASOS, TOP:TOP, NOTAS:NOTAS,
  OPERACIONAL_RELATORIO:OPERACIONAL_RELATORIO, CORTE_CART:CORTE_CART, bloco:bloco };
