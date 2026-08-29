// R.A.D.A.R. Cognitive OS — acesso ao Neon (Postgres serverless).
// Usa o driver HTTP (@neondatabase/serverless): feito para funções Vercel,
// não esgota conexão. A connection string vem de DATABASE_URL (Neon).
//
// Enquanto DATABASE_URL não estiver setado, sql() lança um erro claro — os
// endpoints tratam isso e respondem 503, sem afetar nada do painel em produção.

'use strict';

let _sql = null;
function client() {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) { const e = new Error('DATABASE_URL nao configurado (Neon ainda nao ligado)'); e.code = 'NO_DB'; throw e; }
  // require tardio: só carrega o driver quando o banco existe de fato.
  const { neon } = require('@neondatabase/serverless');
  _sql = neon(url);
  return _sql;
}

// tag: await sql`SELECT * FROM fato WHERE empresa_id = ${id}`
function sql(strings) {
  const c = client();
  return c.apply(null, arguments);
}

// helper de trace: um id por requisição/tick, propagado em todas as escritas.
function newTrace() { return require('crypto').randomUUID(); }

module.exports = { sql, newTrace, hasDB: () => !!process.env.DATABASE_URL };
