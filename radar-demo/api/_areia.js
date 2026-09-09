// _areia.js — CUSTO DA AREIA SECA (usina de areia), a matéria-prima PRINCIPAL da
// argamassa da SKAL. A areia seca sai do forno e entra na mistura; o custo dela por
// tonelada é o maior componente do custo por saco. Fonte: modelo "Custo da Usina de
// Areia" (competência junho/2026). Regra: custeia só o que foi SECO no período (do
// Painel do Forno), não o comprado; a mistura Assis+Skal nos silos = média ponderada.
// Muitos itens ainda são ESTIMADOS/A APURAR — marcados; nunca apresentar como fechados.
'use strict';

var COMPETENCIA = 'junho/2026';

// (A) MATÉRIA-PRIMA — areia in natura (número real, fechamento jun/26).
var IN_NATURA = [
  { origem:'Assis · dragada',       base:'2.335 t × R$ 14,50/t', custo:33857.50,
    nota:'bruto já embute a operação da draga (combustível, pessoal, quentinhas)' },
  { origem:'Skal · comprada (Angelim)', base:'384 m³ × R$ 25/m³ (NF 706)', custo:9600.00,
    nota:'só a areia; frete deste lote foi transporte próprio — diesel/veículo A APURAR' }
];
var IN_NATURA_TOTAL = 43457.50;

// (B) SECAGEM — óleo queimado (normalmente o MAIOR custo da usina). Vem do Painel do
// Forno (L/ton por turno). Aqui só a ESTIMATIVA na meta; o real depende do mês.
var SECAGEM = {
  meta_l_ton: 8, preco_oleo_l: 1.30, custo_ton_estimado_meta: 10.40, // 8 × 1,30
  status: 'ESTIMADO (meta) — DADO A CONFIRMAR o L/ton real e o preço do óleo de junho (Painel do Forno)'
};

// (C) PARÂMETROS de conversão (m³ úmida -> ton seca), os mesmos do Painel do Forno.
var PARAMS = { umidade_pct: 8, densidade_seca_ton_m3: 1.5 };

// (D) COMPONENTES ainda A APURAR (o modelo os marca como estimados).
var A_APURAR = [
  'Produção SECA de junho (ton, por origem) — é o DENOMINADOR do R$/ton; vem do Painel do Forno',
  'Óleo real: L/ton de junho × preço do óleo (o maior peso)',
  'Mão de obra do forno: Total Geral do RH só da equipe do forno (salário + encargos + complementares)',
  'Energia elétrica: rateio por potência × horas dos motores da usina',
  'Manutenção (secador, elevador de canecas, peneira, carregadeira)',
  'Depreciação (secador/forno, silos, esteiras, carregadeira)',
  'Movimentação interna: diesel da carregadeira no pátio',
  'Frete próprio do lote Skal (Angelim): diesel/veículo do transporte'
];

function mil(n){
  if (n >= 1000000) return 'R$ ' + (Math.round(n/10000)/100).toLocaleString('pt-BR') + ' mi';
  if (n >= 1000)    return 'R$ ' + (Math.round(n/100)/10).toLocaleString('pt-BR') + 'k';
  return 'R$ ' + n.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
}

function bloco(){
  var L = [];
  L.push('CUSTO DA AREIA SECA — MATÉRIA-PRIMA PRINCIPAL DA ARGAMASSA (competência '+COMPETENCIA+') — use nas cadeiras de Produção, Controladoria e Suprimentos:');
  L.push('A areia seca sai do forno e é o maior componente do custo por saco da argamassa. Custeia-se só o que foi SECO no período (não o comprado); mistura Assis+Skal nos silos = média ponderada.');
  L.push('(A) IN NATURA jun/26 (REAL): ' + IN_NATURA.map(function(o){ return o.origem+' '+mil(o.custo)+' ('+o.base+')'; }).join('; ') + '. Total in natura = '+mil(IN_NATURA_TOTAL)+'.');
  L.push('(B) SECAGEM (óleo): '+SECAGEM.status+'. Estimativa na meta: '+SECAGEM.meta_l_ton+' L/ton × R$ '+SECAGEM.preco_oleo_l.toFixed(2)+'/L = ~R$ '+SECAGEM.custo_ton_estimado_meta.toFixed(2)+'/ton (só combustível).');
  L.push('(C) Parâmetros: umidade '+PARAMS.umidade_pct+'% · densidade seca '+PARAMS.densidade_seca_ton_m3+' t/m³ (conversão m³ úmida -> ton seca).');
  L.push('A APURAR (sem isso NÃO há R$/ton fechado): ' + A_APURAR.join('; ') + '.');
  L.push('REGRA: NÃO apresentar um R$/ton final como fechado — faltam o denominador (ton seca do mês) e os itens acima. Ao ligar na argamassa: custo da areia por saco = (R$/ton da areia seca) × (kg de areia por saco ÷ 1000) — a formulação (kg areia/saco) é DADO A CONFIRMAR.');
  return L.join('\n');
}

module.exports = { COMPETENCIA:COMPETENCIA, IN_NATURA:IN_NATURA, IN_NATURA_TOTAL:IN_NATURA_TOTAL,
  SECAGEM:SECAGEM, PARAMS:PARAMS, A_APURAR:A_APURAR, bloco:bloco };
