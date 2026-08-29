// Fonte única dos fatos-semente da SKAL (reais cheios). Usada pelo backfill e pelo
// endpoint /api/reseed — assim os nomes de métrica saem SEMPRE corretos, escritos
// por código (o celular do usuário nunca toca nisto).
'use strict';

const EMPRESAS = [
  { codigo: 'SKAL', nome: 'SKAL Engenharia' },
  { codigo: 'KALFIX', nome: 'KALFIX' },
  { codigo: 'QUIMIKA', nome: 'QUIMIKA Industrial' },
  { codigo: 'FCK', nome: 'F.C.K. Ind. e Com. Mat. Construção' }
];

// métrica canônica · valor em BRL cheio · data de referência
const FATOS_SKAL = [
  { metrica: 'folha_liquida',      valor: 124300, data_ref: '2026-07-01' },
  { metrica: 'caixa',              valor: 651200, data_ref: '2026-08-25' },
  { metrica: 'inadimplencia',      valor: 797500, data_ref: '2026-08-26' },
  { metrica: 'tributos_estaduais', valor: 263800, data_ref: '2026-08-17' },
  { metrica: 'tributos_federais',  valor: 213600, data_ref: '2026-08-31' }
];

module.exports = { EMPRESAS, FATOS_SKAL };
