// R.A.D.A.R. Cognitive OS — Fase 1 · detectores proativos
// Código puro (NÃO LLM): baratos, determinísticos, sem alucinação (§35).
// Cada detector recebe dados e devolve uma lista de eventos prontos para gravar.
// É isto que faz o "vigia" deixar de ser uma frase no prompt e virar processo.

'use strict';

// ---- helpers ---------------------------------------------------------------
function ev(o) {
  return Object.assign(
    { severidade: 1, valor: null, contexto: {}, evidencia: {}, ts: new Date().toISOString() },
    o
  );
}
function ym(d) { return d.toISOString().slice(0, 7); }        // 'YYYY-MM'
function media(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : 0; }
function desvpad(a) {
  if (a.length < 2) return 0;
  var m = media(a);
  return Math.sqrt(media(a.map(function (x) { return (x - m) * (x - m); })));
}

// ---------------------------------------------------------------------------
// 1) COMPROMISSO_FUTURO_DETECTADO
// Desembolsos previsíveis do calendário que ainda não estão na projeção.
// Recebe: { empresa, hoje:Date, folhaLiquidaMensal:Number } + config opcional.
// Cobre folha (dia 03), tributos estaduais (dia 17), federais (20-31) e o 13º
// parcelado (nov/dez), usando a folha como base — exatamente o caso do 13º.
// ---------------------------------------------------------------------------
function detectCompromissosFuturos(input) {
  var empresa = input.empresa, hoje = input.hoje || new Date();
  var folha = Number(input.folhaLiquidaMensal) || 0;
  var out = [];
  var ano = hoje.getFullYear(), mes = hoje.getMonth() + 1; // 1-12

  // 13º salário — 1ª parcela até 30/11, 2ª até 20/12. Base = 1 folha líquida.
  if (folha > 0 && mes <= 12) {
    var parcela = Math.round(folha / 2);
    [['1/2', ano + '-11-30'], ['2/2', ano + '-12-20']].forEach(function (p) {
      if (new Date(p[1]) >= hoje) {
        out.push(ev({
          tipo: 'COMPROMISSO_FUTURO_DETECTADO', origem: 'tick/detector-calendario',
          empresa_id: empresa, entidade_tipo: 'conta', entidade_id: 'folha_13o',
          severidade: 3, valor: parcela,
          contexto: { compromisso: '13o salario', parcela: p[0], vence: p[1] },
          evidencia: { fonte: 'fato/folha_liquida', regra: '13o = 1 folha, nov+dez' },
          chave_dedupe: '13o-' + p[0] + '-' + ano
        }));
      }
    });
  }

  // Desembolsos recorrentes do mês corrente ainda não vencidos
  var recorrentes = input.recorrentes || [
    { id: 'folha', dia: 3, valor: folha, rot: 'Folha' },
    { id: 'estaduais', dia: 17, valor: input.tributosEstaduais || 0, rot: 'Tributos estaduais' },
    { id: 'federais', dia: 28, valor: input.tributosFederais || 0, rot: 'Tributos federais' }
  ];
  recorrentes.forEach(function (r) {
    if (!(r.valor > 0)) return;
    var venc = new Date(ano, mes - 1, r.dia);
    if (venc >= hoje) {
      out.push(ev({
        tipo: 'COMPROMISSO_FUTURO_DETECTADO', origem: 'tick/detector-calendario',
        empresa_id: empresa, entidade_tipo: 'conta', entidade_id: r.id,
        severidade: 2, valor: r.valor,
        contexto: { compromisso: r.rot, vence: venc.toISOString().slice(0, 10) },
        evidencia: { regra: 'desembolso recorrente dia ' + r.dia },
        chave_dedupe: r.id + '-' + ym(venc)
      }));
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// 2) DESVIO_DETECTADO
// Valor fora da faixa histórica de uma métrica (banda por z-score).
// Recebe: { empresa, metrica, serie:[{data,valor}], z=2 }.
// ---------------------------------------------------------------------------
function detectDesvio(input) {
  var serie = (input.serie || []).slice().sort(function (a, b) { return a.data < b.data ? -1 : 1; });
  if (serie.length < 4) return [];
  var hist = serie.slice(0, -1).map(function (p) { return Number(p.valor); });
  var ultimo = serie[serie.length - 1];
  var m = media(hist), s = desvpad(hist), z = input.z || 2;
  if (s === 0) return [];
  var score = (Number(ultimo.valor) - m) / s;
  if (Math.abs(score) < z) return [];
  return [ev({
    tipo: 'DESVIO_DETECTADO', origem: 'tick/detector-banda',
    empresa_id: input.empresa, entidade_tipo: 'fato', entidade_id: input.metrica,
    severidade: Math.abs(score) >= 3 ? 4 : 3, valor: Number(ultimo.valor),
    contexto: { metrica: input.metrica, z: Math.round(score * 100) / 100, media: Math.round(m), esperado_faixa: [Math.round(m - z * s), Math.round(m + z * s)] },
    evidencia: { regra: 'z-score sobre ' + hist.length + ' pontos', data: ultimo.data },
    chave_dedupe: 'desvio-' + input.metrica + '-' + ultimo.data
  })];
}

// ---------------------------------------------------------------------------
// 3) RECORRENCIA_AUSENTE
// Item/fornecedor que aparecia todo mês e sumiu no mês corrente.
// Recebe: { empresa, mesRef:'YYYY-MM', lancamentos:[{recorrencia_id, rot, meses:Set/Array}] }
// ---------------------------------------------------------------------------
function detectRecorrenciaAusente(input) {
  var mesRef = input.mesRef, out = [];
  (input.recorrencias || []).forEach(function (r) {
    var meses = r.meses || [];
    // recorrente = apareceu em >=3 meses distintos e NÃO no mês de referência
    if (meses.length >= 3 && meses.indexOf(mesRef) < 0) {
      out.push(ev({
        tipo: 'RECORRENCIA_AUSENTE', origem: 'tick/detector-recorrencia',
        empresa_id: input.empresa, entidade_tipo: 'lancamento', entidade_id: String(r.recorrencia_id),
        severidade: 2, valor: r.valorTipico || null,
        contexto: { item: r.rot, mes_ausente: mesRef, historico_meses: meses.length },
        evidencia: { regra: 'recorrente >=3 meses, ausente no mes corrente' },
        chave_dedupe: 'ausente-' + r.recorrencia_id + '-' + mesRef
      }));
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// 4) LANCAMENTO_VENCENDO — contas entrando na janela de vencimento.
// Recebe: { empresa, hoje:Date, janelaDias=7, lancamentos:[{id,tipo,valor,vencimento,rot}] }
// ---------------------------------------------------------------------------
function detectLancamentoVencendo(input) {
  var hoje = input.hoje || new Date(), jan = input.janelaDias || 7, out = [];
  var limite = new Date(hoje.getTime() + jan * 86400000);
  (input.lancamentos || []).forEach(function (l) {
    if (!l.vencimento) return;
    var v = new Date(l.vencimento);
    if (v >= hoje && v <= limite) {
      out.push(ev({
        tipo: 'LANCAMENTO_VENCENDO', origem: 'tick/detector-prazo',
        empresa_id: input.empresa, entidade_tipo: 'lancamento', entidade_id: String(l.id),
        severidade: l.tipo === 'a_pagar' ? 2 : 1, valor: Number(l.valor),
        contexto: { tipo: l.tipo, item: l.rot, vence: l.vencimento },
        evidencia: { regra: 'vence em ate ' + jan + ' dias' },
        chave_dedupe: 'venc-' + l.id
      }));
    }
  });
  return out;
}

// Roda todos os detectores aplicáveis e devolve os eventos consolidados.
function runAll(ctx) {
  return []
    .concat(detectCompromissosFuturos(ctx))
    .concat(detectLancamentoVencendo(ctx))
    .concat(detectRecorrenciaAusente(ctx))
    .concat((ctx.series || []).reduce(function (acc, s) {
      return acc.concat(detectDesvio({ empresa: ctx.empresa, metrica: s.metrica, serie: s.serie, z: ctx.z }));
    }, []));
}

module.exports = {
  detectCompromissosFuturos: detectCompromissosFuturos,
  detectDesvio: detectDesvio,
  detectRecorrenciaAusente: detectRecorrenciaAusente,
  detectLancamentoVencendo: detectLancamentoVencendo,
  runAll: runAll
};
