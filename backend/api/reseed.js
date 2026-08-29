// POST /api/reseed — carrega/corrige os fatos-semente da SKAL a partir do CÓDIGO
// (nomes de métrica canônicos), independente do que foi digitado à mão no console.
// É o caminho que conserta o 'insumo_líquido' → 'folha_liquida' sem o celular no meio.
// Protegido pelo login (authOk). Idempotente.
'use strict';
const { sql } = require('../lib/db');
const { authOk } = require('../lib/auth');
const { send, noDB } = require('../lib/http');
const { runSeed } = require('../lib/seed-run');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'metodo' });
  if (!authOk(req)) return send(res, 401, { error: 'nao_autorizado' });
  try {
    const r = await runSeed(sql);
    const fatos = await sql`SELECT e.codigo, f.metrica, f.valor, f.unidade_med, f.data_ref
                              FROM fato f JOIN empresa e ON e.id = f.empresa_id
                             WHERE e.codigo = 'SKAL' ORDER BY f.metrica`;
    return send(res, 200, { ok: true, aplicado: r, fatos: fatos });
  } catch (e) {
    if (e.code === 'NO_DB') return noDB(res);
    return send(res, 500, { error: 'erro', detalhe: String(e).slice(0, 200) });
  }
};
