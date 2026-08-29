// Testes dos detectores — rodam sem banco, sem LLM, sem dependência.
// Uso: node test/detectors.test.js   (ou: npm run test:detectors)
'use strict';
const d = require('../lib/detectors');
let ok = 0, fail = 0;
function assert(cond, msg) { if (cond) { ok++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }

console.log('\n[1] 13º salário entra como compromisso futuro (folha SKAL R$ 124.300, reais cheios)');
// detector é agnóstico de unidade: opera no que recebe. Canônico = BRL cheio.
var e1 = d.detectCompromissosFuturos({ empresa: 'SKAL', hoje: new Date('2026-08-29'), folhaLiquidaMensal: 124300 });
var treze = e1.filter(function (x) { return x.entidade_id === 'folha_13o'; });
assert(treze.length === 2, 'gera as 2 parcelas do 13º (nov e dez)');
assert(Math.round(treze[0].valor) === 62150, '1ª parcela = R$ 62.150 (metade da folha)');
assert(treze[0].contexto.vence === '2026-11-30', '1ª parcela vence 30/11');
assert(treze[1].contexto.vence === '2026-12-20', '2ª parcela vence 20/12');
assert(treze[0].tipo === 'COMPROMISSO_FUTURO_DETECTADO', 'tipo de evento correto');

console.log('\n[2] Desvio: inadimplência sai da faixa histórica');
var serie = [
  { data: '2026-04-01', valor: 300 }, { data: '2026-05-01', valor: 320 },
  { data: '2026-06-01', valor: 310 }, { data: '2026-07-01', valor: 305 },
  { data: '2026-08-01', valor: 797 }   // salto
];
var e2 = d.detectDesvio({ empresa: 'SKAL', metrica: 'inadimplencia', serie: serie, z: 2 });
assert(e2.length === 1, 'detecta 1 desvio no salto para 797');
assert(e2[0].severidade >= 3, 'severidade alta (>=3)');

console.log('\n[3] Recorrência ausente: item que vinha todo mês sumiu');
var e3 = d.detectRecorrenciaAusente({
  empresa: 'SKAL', mesRef: '2026-08',
  recorrencias: [{ recorrencia_id: 'aluguel', rot: 'Aluguel galpão', valorTipico: 18, meses: ['2026-04', '2026-05', '2026-06', '2026-07'] }]
});
assert(e3.length === 1, 'sinaliza o item recorrente ausente em agosto');
assert(e3[0].contexto.item === 'Aluguel galpão', 'aponta qual item sumiu');

console.log('\n[4] Idempotência: chaves de dedupe presentes (o tick não reemite)');
assert(treze[0].chave_dedupe && treze[1].chave_dedupe, 'eventos do 13º têm chave_dedupe');
assert(treze[0].chave_dedupe !== treze[1].chave_dedupe, 'cada parcela tem chave distinta');

console.log('\n──────────────────────────────');
console.log(ok + ' passaram, ' + fail + ' falharam');
process.exit(fail ? 1 : 0);
