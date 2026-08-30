// _cobranca.js — carteira a receber POR CLIENTE (snapshot do ERP), para a cadeira
// de Cobranca analisar maus pagadores / clientes criticos com NOME e NUMERO real,
// em vez de repetir agregado. Fonte: radar/dashboard-executivo-2024-2026.xlsx
// (abas "Inadimplencia ERP" / "Contrapartes"). Corte 27/07/2026.
// OBS: e um SNAPSHOT (uma data). "Saldo Vencido" alto (ou 100% do aberto) = mau
// pagador AGORA; recorrencia mes-a-mes exige snapshots periodicos (a carregar).
'use strict';

var CORTE = '27/07/2026';

// Aging da carteira a receber (faixa, saldo R$, % do aberto, documentos).
var AGING = [
  { faixa:'A vencer',          saldo:3533653.19, pct:66, docs:1599 },
  { faixa:'1-30 dias',         saldo:587076.81,  pct:11, docs:173 },
  { faixa:'31-60 dias',        saldo:117602.12,  pct:2,  docs:59 },
  { faixa:'61-90 dias',        saldo:112082.57,  pct:2,  docs:43 },
  { faixa:'91-180 dias',       saldo:216199.06,  pct:4,  docs:74 },
  { faixa:'Acima de 180 dias', saldo:806085.5,   pct:15, docs:397 }
];
var TOTAL = { saldo:5372699.25, docs:2345, vencidoAjustado:795735.88 }; // vencido reconciliado ~R$796 mil

// TOP 20 devedores: aberto, VENCIDO, documentos, % da carteira.
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

// Reconciliacoes de dono (para NAO ler intragrupo/socio como mau pagador de mercado).
var NOTAS = [
  'KALFIX (R$ 78,1k, 0 vencido) e COLIGADA do grupo — intragrupo, nao mau pagador de mercado.',
  'Jorge Guilherme Costa Ferreira (R$ 47,6k, 100% vencido) e o SOCIO — conta de socio, tratar a parte, nao inadimplencia de cliente.',
  'F. A. Lima Extração de Areia (R$ 285,3k, 100% vencido) e TAMBEM FORNECEDOR de areia (~R$ 108k a pagar) — cabe ENCONTRO DE CONTAS / permuta, nao so cobranca.'
];

function mil(n){
  if (n >= 1000000) return 'R$ ' + (Math.round(n/10000)/100).toLocaleString('pt-BR') + ' mi';
  return 'R$ ' + (Math.round(n/100)/10).toLocaleString('pt-BR') + 'k';
}

// Bloco de texto para o contexto do Conselho (a cadeira de Cobranca usa; as outras ignoram).
function bloco(){
  var L = [];
  L.push('CARTEIRA A RECEBER POR CLIENTE (ERP, corte '+CORTE+') — use SO na cadeira de Cobranca:');
  L.push('Total em aberto R$ 5,37 mi (2.345 docs). Vencido reconciliado ~R$ 796 mil. Aging: ' +
    AGING.map(function(a){ return a.faixa+' '+mil(a.saldo)+' ('+a.pct+'%)'; }).join('; ') + '.');
  L.push('TOP DEVEDORES (aberto | vencido | %vencido | docs) — %vencido alto = mau pagador:');
  TOP.forEach(function(c){
    var pv = c.aberto>0 ? Math.round(c.vencido/c.aberto*100) : 0;
    var flag = pv>=80 ? '  <= CRITICO' : (pv>=40 ? '  <= atencao' : '');
    L.push('- '+c.cliente+': '+mil(c.aberto)+' | venc '+mil(c.vencido)+' | '+pv+'% | '+c.docs+' docs'+flag);
  });
  L.push('RECONCILIACAO (nao confundir): ' + NOTAS.join(' '));
  return L.join('\n');
}

module.exports = { CORTE:CORTE, AGING:AGING, TOTAL:TOTAL, TOP:TOP, NOTAS:NOTAS, bloco:bloco };
