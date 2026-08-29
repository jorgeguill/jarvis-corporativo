// Roda as migrações .sql contra o Neon (DATABASE_URL). Uso: node seed/migrate.js
// Executa cada statement do arquivo em ordem (o schema não usa dollar-quoting,
// então dividir por ';' é seguro aqui).
'use strict';
const fs = require('fs');
const path = require('path');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL nao definido. Crie o projeto no Neon e exporte a string.'); process.exit(1); }
  const { neon } = require('@neondatabase/serverless');
  const sql = neon(url);

  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter(function (f) { return f.endsWith('.sql'); }).sort();
  for (const f of files) {
    const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    const stmts = raw
      .split(/;\s*(?:\r?\n|$)/)
      .map(function (s) { return s.replace(/^\s*--.*$/gm, '').trim(); })
      .filter(Boolean);
    console.log('→ ' + f + ' (' + stmts.length + ' statements)');
    for (const st of stmts) { await sql.query(st); }
  }
  console.log('OK — migrações aplicadas.');
}
main().catch(function (e) { console.error('FALHOU:', e.message); process.exit(1); });
