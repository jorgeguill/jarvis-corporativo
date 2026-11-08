// _forno.js — PONTE AO VIVO com o Painel do Forno (usina de areia).
// Lê turnos / recebimentos / parametros do Firebase Realtime DB do Painel do Forno
// pela API REST (sem npm, sem SDK) e calcula os MESMOS KPIs do painel: produção
// seca (ton), consumo específico (kg/ton no gás, L/ton no óleo), preço médio do
// combustível e o custo da secagem por tonelada. Alimenta o _areia / Conselho / KPIs.
// Qualquer falha de rede é tratada pelo chamador (cai nos literais); NUNCA derruba o painel.
'use strict';

var FORNO_DB = process.env.FORNO_DB_URL || 'https://painel-forno-default-rtdb.firebaseio.com';
var OLEO_ATE = '2026-09-15'; // turnos/datas antes disto = óleo por padrão (mesmo piso do Painel)
var DEFAULT = { umidade: 8, densidade: 1.5, concha_m3: 2.1, meta: 5 };

// ---- util ----
function num(x) { var n = Number(x); return isFinite(n) ? n : 0; }
function mes(d) { return d ? String(d).slice(0, 7) : ''; }
function toArr(obj) {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj.filter(Boolean);
  return Object.keys(obj).map(function (k) { var v = obj[k] || {}; if (typeof v === 'object') v.id = k; return v; });
}
async function getJSON(path) {
  var ctrl = new AbortController(); var to = setTimeout(function () { ctrl.abort(); }, 8000);
  try {
    var r = await fetch(FORNO_DB + path + '.json', { signal: ctrl.signal, headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error('firebase ' + r.status + ' em ' + path);
    return await r.json();
  } finally { clearTimeout(to); }
}

// ---- fórmulas (idênticas ao Painel do Forno) ----
function recebComb(r) { return (r && r.combustivel) || 'oleo'; }
function recebQtd(r) { if (!r) return 0; if (recebComb(r) === 'gas') return num(r.kg); return (num(r.depois) - num(r.antes)) || 0; }
function recebPreco(r) { if (!r) return null; var p = recebComb(r) === 'gas' ? num(r.preco_kg) : num(r.preco_litro); return (isFinite(p) && p > 0) ? p : null; }
function unidadeCons(c) { return c === 'gas' ? 'kg/ton' : 'L/ton'; }
function unidadeQtd(c) { return c === 'gas' ? 'kg' : 'L'; }
function combLabel(c) { return c === 'gas' ? 'gás' : 'óleo'; }
function turnoConchas(t) { if (Array.isArray(t.lotes) && t.lotes.length) return t.lotes.reduce(function (s, l) { return s + num(l && l.conchas); }, 0); return num(t.conchas); }
function tonOf(t, P) { var m3u = num(t.m3_umida); if (!m3u) { var c = turnoConchas(t); if (c) m3u = c * P.concha_m3; } return { m3u: m3u, ton: m3u * (1 - P.umidade / 100) * P.densidade }; }
function byDate(a, b) { var x = a && a.data || '', y = b && b.data || ''; return x < y ? -1 : (x > y ? 1 : 0); }
function combDaData(data, recs) {
  if (data && data < OLEO_ATE) return 'oleo';
  var rs = recs.filter(function (r) { return r && r.data && r.data <= data; }).slice().sort(byDate);
  return rs.length ? recebComb(rs[rs.length - 1]) : 'oleo';
}
function combAtual(recs) {
  var rs = recs.filter(function (r) { return r && r.data && r.combustivel; }).slice().sort(byDate);
  return rs.length ? rs[rs.length - 1].combustivel : 'gas';
}
function combDoTurno(t, recs) { return (t && (t.combustivel === 'gas' || t.combustivel === 'oleo')) ? t.combustivel : combDaData(t && t.data, recs); }
function precoMedio(comb, recs, padrao) {
  var s = 0, l = 0;
  recs.forEach(function (r) { if (recebComb(r) !== comb) return; var p = recebPreco(r), q = recebQtd(r); if (p && isFinite(q) && q > 0) { s += p * q; l += q; } });
  return l > 0 ? s / l : (padrao || (comb === 'gas' ? 5.60 : 2.50));
}
// média do período (conjunto de turnos/recebimentos) = Σ qtd recebida ÷ Σ ton do combustível
function mediaPeriodo(comb, turnos, recs, P) {
  var qtd = recs.filter(function (r) { return recebComb(r) === comb; }).reduce(function (s, r) { return s + recebQtd(r); }, 0);
  var ton = turnos.filter(function (t) { return t && t.data && combDoTurno(t, recs) === comb; }).reduce(function (s, t) { return s + tonOf(t, P).ton; }, 0);
  return (ton > 0 && qtd > 0) ? { cons: qtd / ton, ton: ton, qtd: qtd } : { cons: null, ton: ton, qtd: qtd };
}

// ---- snapshot ao vivo ----
async function snapshot() {
  var raw;
  try {
    var r = await Promise.all([getJSON('/turnos'), getJSON('/recebimentos'), getJSON('/parametros')]);
    raw = { turnos: r[0], recebimentos: r[1], parametros: r[2] };
  } catch (e) {
    return { ok: false, fonte: 'Painel do Forno (Firebase)', msg: String(e && e.message || e).slice(0, 160) };
  }
  var turnos = toArr(raw.turnos).filter(function (t) { return t && t.data; });
  var recs = toArr(raw.recebimentos).filter(function (r) { return r && r.data; });
  var pm = raw.parametros || {};
  var P = {
    umidade: isFinite(Number(pm.umidade)) && pm.umidade !== '' ? Number(pm.umidade) : DEFAULT.umidade,
    densidade: isFinite(Number(pm.densidade)) && pm.densidade !== '' ? Number(pm.densidade) : DEFAULT.densidade,
    concha_m3: isFinite(Number(pm.concha_m3)) && pm.concha_m3 !== '' ? Number(pm.concha_m3) : DEFAULT.concha_m3,
    meta: isFinite(Number(pm.meta)) && pm.meta !== '' ? Number(pm.meta) : DEFAULT.meta
  };
  if (!turnos.length && !recs.length) {
    return { ok: false, fonte: 'Painel do Forno (Firebase)', msg: 'conectou, mas sem dados (turnos/recebimentos vazios ou sem leitura)' };
  }

  var datas = turnos.map(function (t) { return t.data; }).concat(recs.map(function (r) { return r.data; })).filter(Boolean).sort();
  var atual = combAtual(recs);

  // produção seca total e por origem
  var prodTon = 0, porOrigem = {};
  turnos.forEach(function (t) {
    var ton = tonOf(t, P).ton; prodTon += ton;
    var o = String(t.fornecedor_areia || '—').trim().toUpperCase().replace(/\s+/g, ' '); porOrigem[o] = (porOrigem[o] || 0) + ton;
  });

  // consumo específico do PERÍODO do combustível atual (desde a 1ª nota dele)
  var iniAtual = recs.filter(function (r) { return recebComb(r) === atual; }).map(function (r) { return r.data; }).sort()[0] || null;
  var turnosAtual = turnos.filter(function (t) { return !iniAtual || t.data >= iniAtual; });
  var recsAtual = recs.filter(function (r) { return recebComb(r) === atual && (!iniAtual || r.data >= iniAtual); });
  var mp = mediaPeriodo(atual, turnosAtual, recsAtual, P);
  var preco = precoMedio(atual, recsAtual.length ? recsAtual : recs, atual === 'gas' ? 5.60 : 2.50);
  var custoSecagemTon = (mp.cons != null) ? mp.cons * preco : null;
  // Representatividade: um combustível recém-iniciado (poucos dias / poucas notas) tem o
  // kg/ton distorcido — uma carga a granel diluída em pouca produção infla o consumo.
  function diasEntre(a, b) { return (a && b) ? Math.round((new Date(b) - new Date(a)) / 86400000) : 0; }
  var fimData = datas.length ? datas[datas.length - 1] : null;
  var diasAtual = iniAtual ? diasEntre(iniAtual, fimData) : 0;
  var parcial = (!iniAtual) || diasAtual < 21 || recsAtual.length < 2;
  var custoRef = +((P.meta || 0) * preco).toFixed(2); // meta × preço = referência saudável

  // quebra mensal
  var meses = {};
  turnos.forEach(function (t) { var k = mes(t.data); (meses[k] = meses[k] || { turnos: [], recs: [] }).turnos.push(t); });
  recs.forEach(function (r) { var k = mes(r.data); (meses[k] = meses[k] || { turnos: [], recs: [] }).recs.push(r); });
  var mensal = Object.keys(meses).sort().map(function (k) {
    var g = meses[k];
    var combMes = (function () {
      var cnt = { gas: 0, oleo: 0 };
      g.turnos.forEach(function (t) { var c = combDoTurno(t, recs); if (c === 'gas' || c === 'oleo') cnt[c]++; });
      if (!cnt.gas && !cnt.oleo) return atual;
      return cnt.gas >= cnt.oleo ? 'gas' : 'oleo';
    })();
    var m = mediaPeriodo(combMes, g.turnos, g.recs.filter(function (r) { return recebComb(r) === combMes; }), P);
    var pr = precoMedio(combMes, g.recs.length ? g.recs : recs, combMes === 'gas' ? 5.60 : 2.50);
    return {
      mes: k, combustivel: combMes, unidade: unidadeCons(combMes),
      producao_ton: +m.ton.toFixed(1),
      consumo_esp: m.cons != null ? +m.cons.toFixed(2) : null,
      preco: +pr.toFixed(2),
      custo_secagem_ton: m.cons != null ? +(m.cons * pr).toFixed(2) : null,
      turnos: g.turnos.length, recebimentos: g.recs.length
    };
  });

  var origemArr = Object.keys(porOrigem).map(function (o) { return { origem: o, ton: +porOrigem[o].toFixed(1) }; }).sort(function (a, b) { return b.ton - a.ton; });

  return {
    ok: true,
    fonte: 'Painel do Forno (Firebase)',
    atualizado_em: new Date().toISOString(),
    combustivel_atual: atual,
    unidade_consumo: unidadeCons(atual),
    periodo: { ini: datas[0] || null, fim: datas[datas.length - 1] || null },
    turnos: turnos.length,
    recebimentos: recs.length,
    producao_seca_ton: +prodTon.toFixed(1),
    producao_por_origem: origemArr,
    consumo_especifico: mp.cons != null ? +mp.cons.toFixed(2) : null, // do período do combustível atual
    consumo_parcial: parcial,            // true = combustível recém-iniciado, número ainda não representativo
    dias_combustivel_atual: diasAtual,
    preco_medio: +preco.toFixed(2),
    custo_secagem_ton: custoSecagemTon != null ? +custoSecagemTon.toFixed(2) : null,
    custo_secagem_ton_referencia: custoRef, // meta × preço (usar quando o atual está parcial)
    parametros: P,
    mensal: mensal
  };
}

// Texto para o Conselho/vigia (análogo ao _areia.bloco, porém AO VIVO).
function bloco(s) {
  if (!s || !s.ok) return 'PAINEL DO FORNO (ao vivo): indisponível no momento' + (s && s.msg ? ' — ' + s.msg : '') + '. Usar os valores do módulo de custo da areia (estimados) e marcar DADO A CONFIRMAR.';
  var u = unidadeQtd(s.combustivel_atual), uc = s.unidade_consumo, nome = combLabel(s.combustivel_atual);
  var L = [];
  L.push('PAINEL DO FORNO — DADOS AO VIVO (usina de areia; fonte do custo de secagem e da produção seca):');
  L.push('Combustível atual: ' + nome + '. Período com dados: ' + (s.periodo.ini || '?') + ' a ' + (s.periodo.fim || '?') + '. Turnos: ' + s.turnos + ' · Abastecimentos: ' + s.recebimentos + '.');
  L.push('Produção SECA no período: ' + s.producao_seca_ton.toLocaleString('pt-BR') + ' t' + (s.producao_por_origem.length ? ' (por origem: ' + s.producao_por_origem.map(function (o) { return o.origem + ' ' + o.ton.toLocaleString('pt-BR') + ' t'; }).join('; ') + ')' : '') + '.');
  if (s.consumo_especifico != null) L.push('Consumo específico (combustível atual): ' + s.consumo_especifico.toLocaleString('pt-BR') + ' ' + uc + ' · preço médio R$ ' + s.preco_medio.toLocaleString('pt-BR') + '/' + u + ' · CUSTO DA SECAGEM ≈ R$ ' + (s.custo_secagem_ton != null ? s.custo_secagem_ton.toLocaleString('pt-BR') : '?') + '/t (só combustível).');
  else L.push('Consumo específico: sem nota suficiente no período atual para fechar — DADO A CONFIRMAR.');
  if (s.consumo_parcial) L.push('⚠ ATENÇÃO: o combustível atual (' + nome + ') começou há ' + s.dias_combustivel_atual + ' dia(s) / poucas notas — o consumo e o custo ACIMA são PARCIAIS e NÃO representativos (carga a granel diluída em pouca produção infla o ' + uc + '). Use como referência a meta: ' + s.parametros.meta + ' ' + uc + ' × R$ ' + s.preco_medio.toLocaleString('pt-BR') + '/' + u + ' = ~R$ ' + s.custo_secagem_ton_referencia.toLocaleString('pt-BR') + '/t. Aguardar o mês fechar para o número real.');
  if (s.mensal && s.mensal.length) {
    var ult = s.mensal.slice(-3);
    L.push('Últimos meses: ' + ult.map(function (m) { return m.mes + ' (' + combLabel(m.combustivel) + '): ' + (m.consumo_esp != null ? m.consumo_esp + ' ' + m.unidade : 's/ fechar') + ', prod ' + m.producao_ton + ' t' + (m.custo_secagem_ton != null ? ', secagem R$ ' + m.custo_secagem_ton + '/t' : ''); }).join(' | ') + '.');
  }
  L.push('Parâmetros: umidade ' + s.parametros.umidade + '% · densidade ' + s.parametros.densidade + ' t/m³ · meta ' + s.parametros.meta + ' ' + uc + '. REGRA: o custo da secagem aqui é só combustível; o R$/ton completo da areia ainda soma mão de obra, energia, manutenção e depreciação (ver módulo de custo da areia).');
  return L.join('\n');
}

module.exports = { snapshot: snapshot, bloco: bloco, FORNO_DB: FORNO_DB };
