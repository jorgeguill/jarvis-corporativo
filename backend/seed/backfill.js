// Backfill idempotente (CLI): leva os fatos-semente da SKAL para o banco, com os
// nomes de métrica CANÔNICOS (fonte: lib/seed-data.js). Uso: node seed/backfill.js
// Repetível sem duplicar; também limpa nomes errados (ex.: 'insumo_líquido').
'use strict';
const { runSeed } = require('../lib/seed-run');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL nao definido.'); process.exit(1); }
  const { neon } = require('@neondatabase/serverless');
  const sql = neon(url);
  const r = await runSeed(sql);
  console.log('OK — ' + r.empresas + ' empresas, ' + r.fatos + ' fatos canônicos da SKAL.');
}
main().catch(function (e) { console.error('FALHOU:', e.message); process.exit(1); });
