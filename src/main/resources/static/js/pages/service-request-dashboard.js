/* global Chart -- js/vendor/chart.umd.min.js, carregado com defer antes deste módulo */
import { initAppShell } from '../components/app-shell.js';
import {
  addDays,
  byAssignee,
  byCategory,
  computeBacklog,
  computeMetrics,
  computeTrend,
  groupCount,
  parseDay,
  previousPeriod,
  spanDays,
  toDayKey,
} from '../components/service-request-metrics.js';
import { api } from '../core/api.js';
import { el } from '../core/dom.js';
import { handleError } from '../core/errors.js';

const numberFormatter = new Intl.NumberFormat('pt-BR');
const percentFormatter = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat('pt-BR');

const PRESETS = ['mes', 'mes-anterior', '30d', '90d', 'ano', 'personalizado'];

const form = document.querySelector('.js-period');
const presetField = form.elements.namedItem('atalho');
const fromField = form.elements.namedItem('de');
const toField = form.elements.namedItem('ate');
const periodLabel = document.querySelector('.js-period-label');
const kpiRoot = document.querySelector('.js-kpis');
const trendMeta = document.querySelector('.js-trend-meta');
const trendCanvas = document.querySelector('.js-trend-chart');
const deadlineRoot = document.querySelector('.js-deadline');
const categoryRoot = document.querySelector('.js-by-category');
const assigneeRoot = document.querySelector('.js-by-assignee');
const channelRoot = document.querySelector('.js-by-channel');
const typeRoot = document.querySelector('.js-by-type');

const state = { items: [], loaded: false, period: null, preset: 'mes' };
let trendChart = null;

initAppShell().catch(() => {}); // erros do usuário logado já são tratados no shell

// ── Formatação ───────────────────────────────────────────────

const fmt = (value) => numberFormatter.format(value);
const pct = (share) => (share == null ? '—' : percentFormatter.format(share));
const plural = (count, one, many) => `${fmt(count)} ${count === 1 ? one : many}`;

// ── Período (espelhado na query string) ──────────────────────

function presetPeriod(preset, today = new Date()) {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  switch (preset) {
    case 'mes-anterior':
      return { from: new Date(day.getFullYear(), day.getMonth() - 1, 1), to: new Date(day.getFullYear(), day.getMonth(), 0) };
    case '30d':
      return { from: addDays(day, -29), to: day };
    case '90d':
      return { from: addDays(day, -89), to: day };
    case 'ano':
      return { from: new Date(day.getFullYear(), 0, 1), to: day };
    default:
      return { from: new Date(day.getFullYear(), day.getMonth(), 1), to: day };
  }
}

function readStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const preset = PRESETS.includes(params.get('periodo')) ? params.get('periodo') : 'mes';
  const valid = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '');
  if (preset === 'personalizado' && valid(params.get('de')) && valid(params.get('ate')) && params.get('de') <= params.get('ate')) {
    return { preset, period: { from: parseDay(params.get('de')), to: parseDay(params.get('ate')) } };
  }
  const fallback = preset === 'personalizado' ? 'mes' : preset;
  return { preset: fallback, period: presetPeriod(fallback) };
}

function writeStateToUrl() {
  const params = new URLSearchParams();
  if (state.preset !== 'mes') params.set('periodo', state.preset);
  if (state.preset === 'personalizado') {
    params.set('de', toDayKey(state.period.from));
    params.set('ate', toDayKey(state.period.to));
  }
  const query = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
}

function fillForm() {
  presetField.value = state.preset;
  fromField.value = toDayKey(state.period.from);
  toField.value = toDayKey(state.period.to);
  // O calendário já não deixa escolher um período invertido
  toField.min = fromField.value;
  fromField.max = toField.value;
}

presetField.addEventListener('change', () => {
  state.preset = presetField.value;
  if (state.preset !== 'personalizado') state.period = presetPeriod(state.preset);
  fillForm();
  render();
});

// Mexer nas datas vira período personalizado; datas vazias ou invertidas são ignoradas
form.addEventListener('change', (event) => {
  if (event.target === presetField) return;
  if (!fromField.value || !toField.value || fromField.value > toField.value) return;
  state.preset = 'personalizado';
  state.period = { from: parseDay(fromField.value), to: parseDay(toField.value) };
  fillForm();
  render();
});

form.addEventListener('submit', (event) => event.preventDefault());

// ── Indicadores ──────────────────────────────────────────────

// Variação contra o período anterior de mesmo tamanho. Neutra de propósito: subir é bom
// em "finalizados" e ruim em "reclamações"; o número fala, a cor não julga
function deltaText(current, previous) {
  const diff = current - previous;
  if (diff === 0) return { text: `Igual ao período anterior (${fmt(previous)})`, dir: 'flat' };
  const sign = diff > 0 ? '+' : '−';
  return { text: `${sign}${fmt(Math.abs(diff))} sobre o período anterior (${fmt(previous)})`, dir: diff > 0 ? 'up' : 'down' };
}

function kpiContent(key, m) {
  switch (key) {
    case 'finished':
      return { value: m.finished, note: `de ${plural(m.opened, 'aberto', 'abertos')} no período` };
    case 'resolved':
      return {
        value: m.resolved,
        share: m.shares.resolved,
        note: `${pct(m.shares.resolved)} dos finalizados${m.resolvedUnknown ? `, ${fmt(m.resolvedUnknown)} sem resposta` : ''}`,
      };
    case 'onTime':
      return { value: m.onTime, share: m.shares.onTime, note: `${pct(m.shares.onTime)} dos finalizados, ${fmt(m.late)} com atraso` };
    case 'complaints':
      return { value: m.complaints, note: `${pct(m.shares.complaints)} dos abertos no período` };
    case 'rn':
      return { value: m.rn, note: `${fmt(m.rnByKind.consultas)} de consultas e ${fmt(m.rnByKind.exames)} de exames` };
    case 'rnResolvedOnTime':
      return {
        value: m.rnResolvedOnTime,
        share: m.shares.rnResolvedOnTime,
        note: `${pct(m.shares.rnResolvedOnTime)} das ${plural(m.rnFinished, 'RN finalizada', 'RN finalizadas')}`,
      };
    default:
      return { value: 0, note: '' };
  }
}

function renderKpis(metrics, previous) {
  kpiRoot.querySelectorAll('[data-kpi]').forEach((card) => {
    const key = card.dataset.kpi;
    const content = kpiContent(key, metrics);
    const delta = deltaText(content.value, kpiContent(key, previous).value);

    card.querySelector('.js-kpi-value').textContent = fmt(content.value);
    card.querySelector('.js-kpi-note').textContent = content.note;
    const deltaEl = card.querySelector('.js-kpi-delta');
    deltaEl.textContent = delta.text;
    deltaEl.dataset.dir = delta.dir;

    const meter = card.querySelector('.js-kpi-meter');
    if (meter) meter.style.setProperty('--share', String(content.share ?? 0));
  });
}

// ── Prazo e resolução (barras segmentadas em HTML) ───────────

/**
 * Barra 100% com legenda. tone = cor de status (o rótulo escrito é o sinal principal).
 * @param {string} title
 * @param {string} caption
 * @param {{ label: string, count: number, tone: string }[]} segments
 */
function segmentBlock(title, caption, segments) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  const visible = segments.filter((segment) => segment.count > 0);

  const bar = el('div', { className: 'c-stack-bar', attrs: { 'aria-hidden': 'true' } },
    total === 0
      ? [el('span', { className: 'c-stack-bar__empty' })]
      : visible.map((segment) => el('span', {
        className: `c-stack-bar__segment c-stack-bar__segment--${segment.tone}`,
        attrs: { style: `flex-grow: ${segment.count}`, title: `${segment.label}: ${fmt(segment.count)}` },
      })));

  const legend = el('ul', { className: 'c-stack-legend' }, segments.map((segment) =>
    el('li', { className: 'c-stack-legend__item' }, [
      el('span', { className: `c-stack-legend__swatch c-stack-bar__segment--${segment.tone}`, attrs: { 'aria-hidden': 'true' } }),
      el('span', { className: 'c-stack-legend__label', text: segment.label }),
      el('span', { className: 'c-stack-legend__value', text: fmt(segment.count) }),
      el('span', { className: 'c-stack-legend__share', text: total ? pct(segment.count / total) : '—' }),
    ])));

  return el('section', { className: 'c-stack' }, [
    el('header', { className: 'c-stack__header' }, [
      el('h3', { className: 'c-stack__title', text: title }),
      el('p', { className: 'c-stack__caption', text: caption }),
    ]),
    bar,
    legend,
  ]);
}

function renderDeadline(metrics, backlog) {
  deadlineRoot.replaceChildren(
    segmentBlock('Finalizados no período', plural(metrics.finished, 'finalizado', 'finalizados'), [
      { label: 'No prazo', count: metrics.onTime, tone: 'good' },
      { label: 'Com atraso', count: metrics.late, tone: 'critical' },
    ]),
    segmentBlock('Resolução dos finalizados', 'Informada ao finalizar', [
      { label: 'Resolvidos', count: metrics.resolved, tone: 'good' },
      { label: 'Não resolvidos', count: metrics.notResolved, tone: 'critical' },
      { label: 'Sem resposta', count: metrics.resolvedUnknown, tone: 'neutral' },
    ]),
    segmentBlock('Em aberto agora', `${plural(backlog.total, 'atendimento', 'atendimentos')}, independe do período`, [
      { label: 'Dentro do prazo', count: backlog.ok, tone: 'neutral' },
      { label: 'Prestes a vencer', count: backlog.warning, tone: 'warning' },
      { label: 'Vencidos', count: backlog.overdue, tone: 'critical' },
    ]),
    el('p', { className: 'c-stack__stat' }, [
      'Tempo médio até finalizar: ',
      el('strong', {
        text: metrics.averageDays == null ? '—' : `${decimalFormatter.format(metrics.averageDays)} ${metrics.averageDays === 1 ? 'dia útil' : 'dias úteis'}`,
      }),
    ]),
  );
}

// ── Quebras (listas com barra) ───────────────────────────────

function emptyNote(text) {
  return el('p', { className: 'c-panel__empty', text });
}

/**
 * Lista com barra proporcional ao maior valor.
 * @param {{ name: string, count: number, extra?: string, extraTitle?: string }[]} rows
 */
function barList(rows, { title, extraHeader } = {}) {
  if (rows.length === 0) return emptyNote('Nenhum atendimento aberto no período.');
  const max = Math.max(...rows.map((row) => row.count));
  return el('div', { className: 'c-bar-list' }, [
    ...(title ? [el('h3', { className: 'c-bar-list__title', text: title })] : []),
    ...(extraHeader ? [el('p', { className: 'c-bar-list__extra-header', text: extraHeader })] : []),
    el('ul', { className: 'c-bar-list__rows' }, rows.map((row) => el('li', { className: 'c-bar-list__row' }, [
      el('span', { className: 'c-bar-list__name', text: row.name, attrs: { title: row.name } }),
      el('span', { className: 'c-bar-list__track', attrs: { 'aria-hidden': 'true' } }, [
        el('span', { className: 'c-bar-list__fill', attrs: { style: `width: ${max ? (row.count / max) * 100 : 0}%` } }),
      ]),
      el('span', { className: 'c-bar-list__value', text: fmt(row.count) }),
      ...(row.extra !== undefined ? [el('span', { className: 'c-bar-list__extra', text: row.extra, attrs: { title: row.extraTitle ?? '' } })] : []),
    ]))),
  ]);
}

function renderBreakdowns(metrics) {
  categoryRoot.replaceChildren(barList(byCategory(metrics).map((row) => ({
    ...row,
    extra: pct(row.onTimeShare),
    extraTitle: row.onTimeShare == null ? 'Nenhum finalizado no período' : 'Dos finalizados no período, quantos saíram no prazo',
  })), { extraHeader: 'No prazo' }));

  channelRoot.replaceChildren(barList(groupCount(metrics.openedItems, (item) => item.channelName, 5), { title: 'Canal' }));
  typeRoot.replaceChildren(barList(groupCount(metrics.openedItems, (item) => item.typeName, 6), { title: 'Tipo' }));

  const rows = byAssignee(state.items, metrics);
  if (rows.length === 0) {
    assigneeRoot.replaceChildren(emptyNote('Nenhum atendimento finalizado ou em aberto.'));
    return;
  }
  const header = ['Responsável', 'Finalizados', 'No prazo', 'Resolvidos', 'Em aberto'];
  assigneeRoot.replaceChildren(el('table', { className: 'c-mini-table' }, [
    el('caption', { className: 'u-visually-hidden', text: 'Desempenho por responsável no período' }),
    el('thead', {}, [el('tr', {}, header.map((text) => el('th', { text, attrs: { scope: 'col' } })))]),
    el('tbody', {}, rows.map((row) => el('tr', {}, [
      el('th', { text: row.name, attrs: { scope: 'row', title: row.name } }),
      el('td', { text: fmt(row.finished) }),
      el('td', { text: pct(row.onTimeShare) }),
      el('td', { text: pct(row.resolvedShare) }),
      el('td', {}, [
        fmt(row.open),
        ...(row.overdue ? [el('span', {
          className: 'c-mini-table__alert',
          text: ` (${fmt(row.overdue)} ${row.overdue === 1 ? 'vencido' : 'vencidos'})`,
        })] : []),
      ]),
    ]))),
  ]));
}

// ── Gráfico de tendência ─────────────────────────────────────

function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function buildTrendChart(trend) {
  trendChart?.destroy();
  const colors = {
    opened: token('--srd-opened'),
    finished: token('--srd-finished'),
    text: token('--color-text-secondary'),
    grid: token('--color-border'),
    surface: token('--color-surface'),
    ink: token('--color-text'),
    font: token('--font-body') || 'sans-serif',
  };
  Chart.defaults.font.family = colors.font;
  Chart.defaults.font.size = 11;
  Chart.defaults.color = colors.text;

  const series = (label, data, color, dashed) => ({
    label,
    data,
    borderColor: color,
    backgroundColor: color,
    borderWidth: 2,
    borderDash: dashed ? [5, 4] : [],
    pointRadius: trend.labels.length > 31 ? 0 : 3,
    pointHoverRadius: 5,
    pointBackgroundColor: color,
    pointBorderColor: colors.surface,
    pointBorderWidth: 2,
    tension: 0.25,
  });

  trendChart = new Chart(trendCanvas, {
    type: 'line',
    data: {
      labels: trend.labels,
      datasets: [
        series('Abertos', trend.opened, colors.opened, true),
        series('Finalizados', trend.finished, colors.finished, false),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false, // altura vem do .c-panel__chart
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false }, // legenda em HTML no cabeçalho do painel
        tooltip: {
          backgroundColor: colors.ink,
          titleColor: colors.surface,
          bodyColor: colors.surface,
          padding: 8,
          cornerRadius: 6,
          boxPadding: 4,
          callbacks: {
            title: (items) => `${trend.unit === 'semana' ? 'Semana de ' : ''}${items[0].label}`,
            label: (item) => ` ${item.dataset.label}: ${fmt(item.raw)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: colors.grid },
          ticks: { color: colors.text, maxRotation: 0, autoSkip: true, autoSkipPadding: 12 },
        },
        y: {
          beginAtZero: true,
          grid: { color: colors.grid },
          border: { display: false },
          ticks: { color: colors.text, precision: 0, maxTicksLimit: 5 },
        },
      },
    },
  });

  const sum = (list) => list.reduce((total, value) => total + value, 0);
  trendMeta.textContent = `Por ${trend.unit}`;
  trendCanvas.setAttribute('aria-label',
    `Atendimentos por ${trend.unit} no período: ${fmt(sum(trend.opened))} abertos e ${fmt(sum(trend.finished))} finalizados.`);
}

// Troca de tema (core/theme.js muda o data-theme): refaz o gráfico com as cores novas
new MutationObserver(() => {
  if (state.loaded) render();
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// ── Renderização ─────────────────────────────────────────────

function render() {
  writeStateToUrl();
  if (!state.loaded) return;

  const { period } = state;
  const previous = previousPeriod(period);
  const metrics = computeMetrics(state.items, period);
  const previousMetrics = computeMetrics(state.items, previous);

  periodLabel.textContent = `${dateFormatter.format(period.from)} a ${dateFormatter.format(period.to)} `
    + `(${plural(spanDays(period), 'dia', 'dias')}), comparado com ${dateFormatter.format(previous.from)} a ${dateFormatter.format(previous.to)}`;

  renderKpis(metrics, previousMetrics);
  renderDeadline(metrics, computeBacklog(state.items));
  renderBreakdowns(metrics);
  buildTrendChart(computeTrend(metrics, period));
}

async function load() {
  try {
    state.items = await api.get('api/service-requests');
    state.loaded = true;
    render();
  } catch (error) {
    periodLabel.textContent = 'Não foi possível carregar os atendimentos. Recarregue a página para tentar de novo.';
    handleError(error);
  }
}

Object.assign(state, readStateFromUrl());
fillForm();
writeStateToUrl();
load();
