// Backfill idempotente: leva os literais que hoje vivem no data.js para o banco.
// Cria as 4 empresas e semeia os fatos conhecidos da SKAL. Uso: node seed/backfill.js
// Repetível sem duplicar (ON CONFLICT). NENHUM número é inventado — são os mesmos
// valores já exibidos no painel.
'use strict';

const EMPRESAS = [
  { codigo: 'SKAL', nome: 'SKAL Engenharia' },
  { codigo: 'KALFIX', nome: 'KALFIX' },
  { codigo: 'QUIMIKA', nome: 'QUIMIKA Industrial' },
  { codigo: 'FCK', nome: 'F.C.K. Ind. e Com. Mat. Construção' }
];

// Fatos já confirmados da SKAL (mesmos valores do painel, em milhares de R$).
const FATOS_SKAL = [
  { metrica: 'folha_liquida', valor: 124.3, unidade_med: 'BRL_mil', data_ref: '2026-07-01', confianca: 1 },
  { metrica: 'caixa', valor: 651.2, unidade_med: 'BRL_mil', data_ref: '2026-08-25', confianca: 1 },
  { metrica: 'inadimplencia', valor: 797.5, unidade_med: 'BRL_mil', data_ref: '2026-08-26', confianca: 1 },
  { metrica: 'tributos_estaduais', valor: 263.8, unidade_med: 'BRL_mil', data_ref: '2026-08-17', confianca: 1 },
  { metrica: 'tributos_federais', valor: 213.6, unidade_med: 'BRL_mil', data_ref: '2026-08-31', confianca: 1 }
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL nao definido.'); process.exit(1); }
  const { neon } = require('@neondatabase/serverless');
  const sql = neon(url);

  // empresas
  for (const e of EMPRESAS) {
    await sql`INSERT INTO empresa (codigo, nome) VALUES (${e.codigo}, ${e.nome})
              ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome`;
  }
  const emp = await sql`SELECT id FROM empresa WHERE codigo = 'SKAL'`;
  const skal = emp[0].id;

  // fonte de seed
  const fnt = await sql`INSERT INTO fonte (tipo, nome) VALUES ('seed', 'backfill data.js') RETURNING id`;
  const fonteId = fnt[0].id;

  // fatos (upsert — a chave única garante 1 fato por métrica/data)
  let n = 0;
  for (const f of FATOS_SKAL) {
    await sql`INSERT INTO fato (empresa_id, metrica, valor, unidade_med, data_ref, fonte_id, confianca)
              VALUES (${skal}, ${f.metrica}, ${f.valor}, ${f.unidade_med}, ${f.data_ref}, ${fonteId}, ${f.confianca})
              ON CONFLICT (empresa_id, unidade_id, metrica, data_ref)
              DO UPDATE SET valor = EXCLUDED.valor, confianca = EXCLUDED.confianca`;
    n++;
  }

  // memória inicial
  await sql`INSERT INTO memoria (empresa_id, tipo, titulo, corpo)
            VALUES (${skal}, 'conhecimento', 'Backfill inicial do painel',
                    'Fatos migrados do data.js para a base. Fonte unica de verdade a partir daqui.')`;

  console.log('OK — ' + EMPRESAS.length + ' empresas, ' + n + ' fatos da SKAL semeados.');
}
main().catch(function (e) { console.error('FALHOU:', e.message); process.exit(1); });
