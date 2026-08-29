// Lógica de seed compartilhada (CLI e endpoint). Recebe um client `sql` (tagged
// template, estilo @neondatabase/serverless) e deixa o banco no estado correto:
// empresas criadas, fatos da SKAL com nomes de métrica CANÔNICOS, e limpa qualquer
// resíduo de nome errado (ex.: 'insumo_líquido' que o paste mobile gerou).
'use strict';
const { EMPRESAS, FATOS_SKAL } = require('./seed-data');

async function runSeed(sql) {
  // 1) empresas
  for (const e of EMPRESAS) {
    await sql`INSERT INTO empresa (codigo, nome) VALUES (${e.codigo}, ${e.nome})
              ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome`;
  }
  const emp = await sql`SELECT id FROM empresa WHERE codigo = 'SKAL'`;
  const skal = emp[0].id;

  // 2) fonte de seed (uma só)
  let fnt = await sql`SELECT id FROM fonte WHERE tipo = 'seed' AND nome = 'seed canônico' LIMIT 1`;
  if (!fnt.length) fnt = await sql`INSERT INTO fonte (tipo, nome) VALUES ('seed', 'seed canônico') RETURNING id`;
  const fonteId = fnt[0].id;

  // 3) LIMPEZA: remove métricas com nome errado que não estão na lista canônica
  //    (conserta o 'insumo_líquido' e afins sem depender do celular).
  const nomes = FATOS_SKAL.map(function (f) { return f.metrica; });
  await sql`DELETE FROM fato WHERE empresa_id = ${skal} AND metrica <> ALL(${nomes})`;

  // 4) upsert dos fatos canônicos (reais cheios)
  let n = 0;
  for (const f of FATOS_SKAL) {
    await sql`INSERT INTO fato (empresa_id, metrica, valor, unidade_med, data_ref, fonte_id, confianca)
              VALUES (${skal}, ${f.metrica}, ${f.valor}, 'BRL', ${f.data_ref}, ${fonteId}, 1)
              ON CONFLICT (empresa_id, unidade_id, metrica, data_ref)
              DO UPDATE SET valor = EXCLUDED.valor, unidade_med = 'BRL', confianca = 1`;
    n++;
  }
  return { empresas: EMPRESAS.length, fatos: n };
}

module.exports = { runSeed };
