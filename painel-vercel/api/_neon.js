// Leitor mínimo do Neon via SQL-over-HTTP — SEM dependência npm (mantém o build do
// painel idêntico). Só é usado quando DATABASE_URL existe; qualquer falha é tratada
// pelo chamador, que cai nos literais. NUNCA derruba o painel.
'use strict';

async function neonQuery(text, params) {
  var cs = process.env.DATABASE_URL;
  if (!cs) { var e = new Error('NO_DB'); e.code = 'NO_DB'; throw e; }
  var host = new URL(cs.replace(/^postgres(ql)?:\/\//, 'https://')).host;
  var r = await fetch('https://' + host + '/sql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Neon-Connection-String': cs,
      'Neon-Raw-Text-Output': 'true',
      'Neon-Array-Mode': 'false'
    },
    body: JSON.stringify({ query: text, params: params || [] })
  });
  if (!r.ok) throw new Error('neon ' + r.status);
  var data = await r.json();
  return data.rows || [];
}

module.exports = { neonQuery: neonQuery };
