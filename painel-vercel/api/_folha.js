// _folha.js — folha de pagamento do grupo por competência, para as cadeiras de RH e
// Financeiro lerem o custo de pessoal REAL (não estimado). Fonte: relatórios de folha
// mensal do TOTVS (SKAL "Extrato Mensal" 27p + KALFIX "Folha Analítica" 7p), extraídos
// e reconciliados (proventos − descontos = líquido, conferido por funcionário).
// Cada empresa é o caixa da PRÓPRIA folha (SKAL paga a folha da SKAL; KALFIX a dela).
'use strict';

var COMPETENCIA = '08/2026';

var SKAL = {
  competencia:'08/2026', funcionarios:76,
  proventos:171621.75, descontos:44387.01, liquido:127234.74,
  // encargos/guias (o que é recolhido)
  inss_gps:58646.85,      // Total INSS (segurados 13.178,47 + empresa 31.212,77 + RAT 4.322,34 + terceiros 9.051,67 + contribuintes 881,60)
  inss_patronal:44586.78, // empresa + RAT + terceiros (o CUSTO do empregador, fora o retido do empregado)
  base_fgts:156063.89, fgts:12122.76,
  base_irrf:116236.46, irrf:0.00
};
var KALFIX = {
  competencia:'08/2026', funcionarios:23,
  proventos:46325.33, descontos:17854.62, liquido:28470.71
};

// Série de folha líquida da SKAL (para tendência; adicionar competências ao longo do tempo).
var HIST_SKAL = [
  { comp:'07/2026', liquido:124300.00 },   // referência anterior (folha de julho, aproximada)
  { comp:'08/2026', liquido:127234.74 }
];

function mil(n){
  if (n >= 1000000) return 'R$ ' + (Math.round(n/10000)/100).toLocaleString('pt-BR') + ' mi';
  return 'R$ ' + (Math.round(n/100)/10).toLocaleString('pt-BR') + 'k';
}

// Bloco para o contexto (RH e Financeiro usam; as outras cadeiras ignoram).
function bloco(){
  var L = [];
  L.push('FOLHA DE PAGAMENTO — competência '+COMPETENCIA+' (dados REAIS do TOTVS, reconciliados):');
  L.push('SKAL: '+SKAL.funcionarios+' funcionários · líquido '+mil(SKAL.liquido)+' (proventos '+mil(SKAL.proventos)+' − descontos '+mil(SKAL.descontos)+'). Encargos: INSS/GPS '+mil(SKAL.inss_gps)+' (patronal ~'+mil(SKAL.inss_patronal)+') + FGTS '+mil(SKAL.fgts)+'. IRRF '+mil(SKAL.irrf)+' (base '+mil(SKAL.base_irrf)+').');
  L.push('CUSTO DE PESSOAL SKAL no caixa ≈ líquido '+mil(SKAL.liquido)+' (dia 03/09) + encargos (INSS/GPS dia 20, FGTS dia 07) ≈ '+mil(SKAL.liquido + SKAL.inss_patronal + SKAL.fgts)+'/mês.');
  L.push('KALFIX: '+KALFIX.funcionarios+' funcionários · líquido '+mil(KALFIX.liquido)+' — sai do caixa da KALFIX, NÃO do fluxo da SKAL.');
  var serie = HIST_SKAL.map(function(h){ return h.comp+' '+mil(h.liquido); }).join(' → ');
  L.push('Tendência folha líquida SKAL: '+serie+'. 13º (só SKAL): 2 parcelas ~'+mil(SKAL.liquido/2)+' (nov e dez) — piso, incide sobre o bruto + FGTS/INSS patronal.');
  return L.join('\n');
}

module.exports = { COMPETENCIA:COMPETENCIA, SKAL:SKAL, KALFIX:KALFIX, HIST_SKAL:HIST_SKAL, bloco:bloco };
