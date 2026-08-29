// GET /api/events?empresa=SKAL[&limite=20] — eventos que o vigia (tick) gerou,
// já formatados para a tela (título + mensagem legível + status). Requer login.
'use strict';
const { neonQuery } = require('./_neon');
const { authOk } = require('./_auth');

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
function fmtBRL(v) { v = Number(v); if (!isFinite(v)) return '—';
  if (Math.abs(v) >= 1e6) return 'R$ ' + (v / 1e6).toFixed(2).replace('.', ',') + ' mi';
  return 'R$ ' + (v / 1e3).toFixed(1).replace('.', ',') + ' mil'; }
function dm(s) { if (!s || String(s).indexOf('-') < 0) return s || ''; var a = String(s).split('-'); return a[2] + '/' + a[1]; }
function stOf(sev) { return sev >= 4 ? 'crit' : (sev === 3 ? 'aten' : 'oport'); }

// Transforma um evento do banco numa linha legível para o painel.
function present(e) {
  var c = e.contexto || {}, tp = e.tipo, titulo = 'Alerta', msg = '';
  if (tp === 'COMPROMISSO_FUTURO_DETECTADO') {
    if (e.entidade_id === 'folha_13o') {
      titulo = '13º salário a caminho';
      msg = (c.parcela === '2/2' ? '2ª' : '1ª') + ' parcela ~' + fmtBRL(e.valor) + ' vence ' + dm(c.vence) + '. Provisionar no fluxo.';
    } else {
      titulo = (c.compromisso || 'Desembolso') + ' a caminho';
      msg = '~' + fmtBRL(e.valor) + ' vence ' + dm(c.vence) + '.';
    }
  } else if (tp === 'DESVIO_DETECTADO') {
    titulo = 'Desvio em ' + (c.metrica || 'indicador');
    msg = 'Valor ' + fmtBRL(e.valor) + ' fora da faixa histórica. Investigar.';
  } else if (tp === 'RECORRENCIA_AUSENTE') {
    titulo = 'Item recorrente sumiu';
    msg = (c.item || 'Um item') + ' vinha todo mês e não apareceu em ' + (c.mes_ausente || 'agora') + '. Conferir.';
  } else if (tp === 'LANCAMENTO_VENCENDO') {
    titulo = (c.item || 'Lançamento') + ' vencendo';
    msg = (c.tipo === 'a_pagar' ? 'A pagar' : 'A receber') + ' ' + fmtBRL(e.valor) + ' vence ' + dm(c.vence) + '.';
  }
  return { tipo: tp, severidade: e.severidade, st: stOf(e.severidade), titulo: titulo, msg: msg, ts: e.ts };
}

module.exports = async (req, res) => {
  if (!authOk(req)) return send(res, 401, { error: 'nao_autorizado' });
  var u = new URL(req.url, 'http://x');
  var empresa = (u.searchParams.get('empresa') || 'SKAL').trim();
  var limite = Math.min(parseInt(u.searchParams.get('limite') || '20', 10) || 20, 50);
  try {
    var rows = await neonQuery(
      "SELECT ev.tipo, ev.entidade_id, ev.severidade, ev.valor, ev.contexto, ev.ts " +
      "FROM evento ev JOIN empresa e ON e.id=ev.empresa_id " +
      "WHERE e.codigo=$1 ORDER BY ev.severidade DESC, ev.ts DESC LIMIT $2", [empresa, limite]);
    var eventos = rows.map(function (r) {
      // contexto pode vir como string (raw text output) — normaliza para objeto
      if (typeof r.contexto === 'string') { try { r.contexto = JSON.parse(r.contexto); } catch (e) { r.contexto = {}; } }
      return present(r);
    });
    return send(res, 200, { empresa: empresa, eventos: eventos });
  } catch (e) {
    if (e.code === 'NO_DB') return send(res, 200, { empresa: empresa, eventos: [] });
    return send(res, 200, { empresa: empresa, eventos: [], erro: String(e).slice(0, 120) });
  }
};
