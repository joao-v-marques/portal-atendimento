import { deadlineLevel, finishLead, isFinished } from './service-request-table.js';

/*
 * Indicadores do dashboard de atendimentos (funções puras, sem DOM).
 * Mesma regra de prazo da listagem: 5 dias úteis desde a abertura (service-request-table.js).
 *
 * Recorte do período:
 *  - indicadores de finalização (finalizados, resolvidos, no prazo) usam a data de FINALIZAÇÃO;
 *  - indicadores de entrada (abertos, reclamações, demandas RN) usam a data de ABERTURA.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const dayFormatter = new Intl.DateTimeFormat('en-CA'); // "AAAA-MM-DD" no fuso do navegador

function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/** "AAAA-MM-DD" → Date à meia-noite local. */
export function parseDay(value) {
  const [y, m, d] = String(value).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Date → "AAAA-MM-DD" no fuso local. */
export function toDayKey(date) {
  return dayFormatter.format(date);
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Dias corridos do período, contando o primeiro e o último. */
export function spanDays({ from, to }) {
  return Math.round((to - from) / DAY_MS) + 1;
}

/** Período imediatamente anterior, com o mesmo número de dias (base da comparação). */
export function previousPeriod(period) {
  const days = spanDays(period);
  return { from: addDays(period.from, -days), to: addDays(period.from, -1) };
}

// Instante dentro do período [from 00:00, to 23:59:59] no fuso local
function inPeriod(iso, { from, to }) {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return time >= from.getTime() && time < addDays(to, 1).getTime();
}

/** Tipo "Reclamação" (definição do indicador; a categoria RECLAMAÇÃO não entra). */
export function isComplaint(item) {
  return normalize(item.typeName) === 'reclamacao';
}

/** Demanda RN 566: categorias com "RN 259" no nome (CONSULTAS RN 259, EXAMES RN 259). */
export function isRn(item) {
  return /\brn\s*259\b/.test(normalize(item.categoryName));
}

function rnKind(item) {
  const name = normalize(item.categoryName);
  if (name.startsWith('consulta')) return 'consultas';
  if (name.startsWith('exame')) return 'exames';
  return 'outras';
}

function isOnTime(item) {
  const lead = finishLead(item);
  return Boolean(lead) && lead.early >= 0;
}

function ratio(part, total) {
  return total > 0 ? part / total : null;
}

/**
 * Números de um período.
 * @param {object[]} items todos os atendimentos (GET api/service-requests)
 * @param {{ from: Date, to: Date }} period dias inteiros, fuso local
 */
export function computeMetrics(items, period) {
  const opened = items.filter((item) => inPeriod(item.openedAt, period));
  // Reaberto perde o closedAt: só conta de novo quando for finalizado outra vez
  const finished = items.filter((item) => isFinished(item) && inPeriod(item.closedAt, period));

  const onTime = finished.filter(isOnTime);
  const resolved = finished.filter((item) => item.resolved === true);
  const notResolved = finished.filter((item) => item.resolved === false);
  const rnOpened = opened.filter(isRn);
  const rnFinished = finished.filter(isRn);
  const rnResolvedOnTime = rnFinished.filter((item) => item.resolved === true && isOnTime(item));
  const usedDays = finished.map((item) => finishLead(item)?.used).filter((days) => days != null);

  return {
    opened: opened.length,
    finished: finished.length,
    resolved: resolved.length,
    notResolved: notResolved.length,
    resolvedUnknown: finished.length - resolved.length - notResolved.length,
    onTime: onTime.length,
    late: finished.length - onTime.length,
    complaints: opened.filter(isComplaint).length,
    rn: rnOpened.length,
    rnByKind: {
      consultas: rnOpened.filter((item) => rnKind(item) === 'consultas').length,
      exames: rnOpened.filter((item) => rnKind(item) === 'exames').length,
    },
    rnFinished: rnFinished.length,
    rnResolvedOnTime: rnResolvedOnTime.length,
    averageDays: usedDays.length ? usedDays.reduce((sum, days) => sum + days, 0) / usedDays.length : null,
    shares: {
      resolved: ratio(resolved.length, finished.length),
      onTime: ratio(onTime.length, finished.length),
      complaints: ratio(opened.filter(isComplaint).length, opened.length),
      rnResolvedOnTime: ratio(rnResolvedOnTime.length, rnFinished.length),
    },
    openedItems: opened,
    finishedItems: finished,
  };
}

/** Situação atual dos que estão em aberto (independe do período escolhido). */
export function computeBacklog(items) {
  const levels = items.filter((item) => !isFinished(item)).map(deadlineLevel);
  return {
    total: levels.length,
    ok: levels.filter((level) => level === 'ok').length,
    warning: levels.filter((level) => level === 'warning').length,
    overdue: levels.filter((level) => level === 'overdue').length,
  };
}

// ── Série temporal ───────────────────────────────────────────

const shortDay = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const shortMonth = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' });

// Segunda-feira da semana do dia
function weekStart(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

/**
 * Abertos e finalizados por dia (até 62 dias), semana (até ~6 meses) ou mês.
 * @returns {{ unit: 'dia' | 'semana' | 'mês', labels: string[], opened: number[], finished: number[] }}
 */
export function computeTrend(metrics, period) {
  const days = spanDays(period);
  const unit = days <= 62 ? 'dia' : days <= 186 ? 'semana' : 'mês';

  const bucketOf = (date) => {
    if (unit === 'dia') return toDayKey(date);
    if (unit === 'semana') return toDayKey(weekStart(date));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  // Todas as faixas do período, mesmo as zeradas: o eixo não pode pular dias sem movimento
  const keys = [];
  const labels = [];
  for (let date = new Date(period.from); date <= period.to; date = addDays(date, 1)) {
    const key = bucketOf(date);
    if (keys.includes(key)) continue;
    keys.push(key);
    if (unit === 'mês') labels.push(shortMonth.format(date).replace('.', ''));
    else labels.push(shortDay.format(unit === 'semana' ? weekStart(date) : date));
  }

  const count = (list, field) => {
    const totals = new Map(keys.map((key) => [key, 0]));
    list.forEach((item) => {
      const key = bucketOf(new Date(item[field]));
      if (totals.has(key)) totals.set(key, totals.get(key) + 1);
    });
    return keys.map((key) => totals.get(key));
  };

  return {
    unit,
    labels,
    opened: count(metrics.openedItems, 'openedAt'),
    finished: count(metrics.finishedItems, 'closedAt'),
  };
}

// ── Quebras ──────────────────────────────────────────────────

/**
 * Agrupa e ordena do maior para o menor. Acima de `limit` grupos, o resto vira "Outros".
 * @param {object[]} list
 * @param {(item: object) => string} keyOf
 * @param {number} [limit]
 */
export function groupCount(list, keyOf, limit = 6) {
  const totals = new Map();
  list.forEach((item) => {
    const key = keyOf(item) || 'Não informado';
    totals.set(key, (totals.get(key) ?? 0) + 1);
  });
  const sorted = [...totals].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  if (sorted.length <= limit) return sorted;
  const rest = sorted.slice(limit - 1).reduce((sum, row) => sum + row.count, 0);
  return [...sorted.slice(0, limit - 1), { name: 'Outros', count: rest, isRest: true }];
}

/** Abertos por categoria, com a parte dos finalizados (no período) que saiu no prazo. */
export function byCategory(metrics, limit = 8) {
  const groups = groupCount(metrics.openedItems, (item) => item.categoryName, limit);
  const named = new Set(groups.filter((row) => !row.isRest).map((row) => row.name));
  return groups.map((row) => {
    const finished = metrics.finishedItems.filter((item) =>
      (row.isRest ? !named.has(item.categoryName) : item.categoryName === row.name));
    return { ...row, onTimeShare: ratio(finished.filter(isOnTime).length, finished.length) };
  });
}

/** Por responsável: finalizados no período, % no prazo, % resolvidos e o que tem em aberto hoje. */
export function byAssignee(items, metrics) {
  const names = new Set([
    ...metrics.finishedItems.map((item) => item.assignedToName),
    ...items.filter((item) => !isFinished(item)).map((item) => item.assignedToName),
  ]);
  return [...names].map((name) => {
    const finished = metrics.finishedItems.filter((item) => item.assignedToName === name);
    const open = items.filter((item) => !isFinished(item) && item.assignedToName === name);
    return {
      name: name || 'Não informado',
      finished: finished.length,
      onTimeShare: ratio(finished.filter(isOnTime).length, finished.length),
      resolvedShare: ratio(finished.filter((item) => item.resolved === true).length, finished.length),
      open: open.length,
      overdue: open.filter((item) => deadlineLevel(item) === 'overdue').length,
    };
  }).sort((a, b) => b.finished - a.finished || b.open - a.open);
}
