import { initAppShell } from '../components/app-shell.js';
import { emptyState } from '../components/authorization-table.js';
import { PAGE_SIZE, initPagination, paginate } from '../components/pagination.js';
import { initSatisfactionCharts } from '../components/satisfaction-charts.js';
import {
  FILTER_KEYS,
  applyFilters,
  fillFilters,
  initFilters,
} from '../components/satisfaction-survey-filters.js';
import { initTabs } from '../components/tabs.js';
import { api } from '../core/api.js';
import { el, saveBlob } from '../core/dom.js';
import { handleError } from '../core/errors.js';
import { formatDate } from '../core/format.js';

const numberFormatter = new Intl.NumberFormat('pt-BR');
const percentFormatter = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

const SKELETON_ROWS = 8;
const COLUMN_COUNT = 6;
const TABS = ['listagem', 'dashboard'];
const PAGE_SIZES = [25, 50, 100, 250, 500];
const FETCH_SIZE = 500; // máximo por página aceito pela API

const form = document.querySelector('.js-filters');
const results = document.querySelector('.js-results');
const countEl = results.querySelector('.js-results-count');
const pageSizeSelect = results.querySelector('.js-page-size');
const wrapper = results.querySelector('.js-table-wrapper');
const tbody = results.querySelector('.js-table-body');
const tableState = results.querySelector('.js-table-state');
const exportButton = document.querySelector('.js-export');

const dashboard = document.querySelector('.js-dashboard');
const monthSelect = dashboard.querySelector('.js-month');
const dashboardContent = dashboard.querySelector('.js-dashboard-content');
const dashboardState = dashboard.querySelector('.js-dashboard-state');

// ── Estado (espelhado na query string) ───────────────────────

function readStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('aba');
  const pageSize = Number.parseInt(params.get('linhas') ?? '', 10);
  return {
    tab: TABS.includes(tab) ? tab : 'listagem',
    filters: Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? ''])),
    page: Number.parseInt(params.get('pagina') ?? '', 10) || 1,
    pageSize: PAGE_SIZES.includes(pageSize) ? pageSize : PAGE_SIZE,
    month: /^\d{4}-\d{2}$/.test(params.get('mes') ?? '') ? params.get('mes') : '',
  };
}

// replaceState: F5 e link compartilhado mantêm aba e filtros sem encher o histórico
function writeStateToUrl() {
  const params = new URLSearchParams();
  if (state.tab !== 'listagem') params.set('aba', state.tab);
  FILTER_KEYS.forEach((key) => { if (state.filters[key]) params.set(key, state.filters[key]); });
  if (state.page > 1) params.set('pagina', String(state.page));
  if (state.pageSize !== PAGE_SIZE) params.set('linhas', String(state.pageSize));
  if (state.month) params.set('mes', state.month);
  const query = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
}

const state = {
  ...readStateFromUrl(),
  items: [],
  loaded: false,
};

// ── Componentes ──────────────────────────────────────────────

initAppShell().catch(() => {}); // erros do usuário logado já são tratados no shell

const pagination = initPagination(results.querySelector('.js-pagination'), {
  onChange(page) {
    state.page = page;
    render();
    focusResults();
  },
});

fillFilters(form, state.filters);
const filters = initFilters(form, {
  onChange(nextFilters) {
    state.filters = nextFilters;
    state.page = 1;
    render();
  },
});

const charts = initSatisfactionCharts(dashboard);

// ── Listagem ─────────────────────────────────────────────────

function pluralize(count) {
  return count === 1 ? 'resposta' : 'respostas';
}

// Nota "1".."5" vira selo colorido; qualquer outro valor é "Sem resposta"
function gradeBadge(grade) {
  const value = (grade ?? '').trim();
  const isValid = /^[1-5]$/.test(value);
  return el('span', {
    className: `c-badge c-grade-badge c-grade-badge--${isValid ? value : 'none'}`,
    text: isValid ? `Nota ${value}` : 'Sem resposta',
  });
}

function numberCell(value) {
  return el('td', { className: 'u-text-end l-survey-table__number', text: value == null ? '—' : numberFormatter.format(value) });
}

function renderRow(item) {
  const time = (item.hour ?? '').slice(0, 5); // "14:32:05" → "14:32"
  return el('tr', {}, [
    el('td', {}, [
      el('div', { className: 'l-survey-table__date' }, [
        el('span', { text: formatDate(item.date) }),
        el('span', { className: 'c-table__secondary', text: [item.weekDay, time].filter(Boolean).join(' · ') }),
      ]),
    ]),
    el('td', {}, [gradeBadge(item.grade)]),
    el('td', {}, [el('span', { className: 'c-table__truncate', text: item.finisher || '—', attrs: { title: item.finisher || '—' } })]),
    numberCell(item.time),
    numberCell(item.status),
    numberCell(item.question1),
  ]);
}

function showTable() {
  wrapper.hidden = false;
  tableState.hidden = true;
  tableState.replaceChildren();
}

function renderLoading() {
  showTable();
  wrapper.setAttribute('aria-busy', 'true');
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < SKELETON_ROWS; i++) {
    const cells = Array.from({ length: COLUMN_COUNT }, () =>
      el('td', {}, [el('span', { className: 'c-skeleton c-skeleton--name', attrs: { 'aria-hidden': 'true' } })]));
    fragment.append(el('tr', { className: 'c-table__skeleton-row' }, cells));
  }
  tbody.replaceChildren(fragment);
}

function renderTableState(node) {
  wrapper.hidden = true;
  wrapper.removeAttribute('aria-busy');
  tbody.replaceChildren();
  tableState.replaceChildren(node);
  tableState.hidden = false;
}

function focusResults() {
  const target = wrapper.hidden ? tableState : wrapper;
  target.scrollIntoView({ block: 'start', behavior: 'smooth' });
  target.focus({ preventScroll: true });
}

function clearFiltersButton() {
  const button = el('button', { className: 'c-button c-button--secondary', attrs: { type: 'button' } }, [
    el('span', { className: 'c-icon c-icon--sm c-icon--filter-x', attrs: { 'aria-hidden': 'true' } }),
    'Limpar filtros',
  ]);
  button.addEventListener('click', filters.clear);
  return button;
}

function retryButton(onClick) {
  const button = el('button', { className: 'c-button c-button--secondary', text: 'Tentar novamente', attrs: { type: 'button' } });
  button.addEventListener('click', onClick);
  return button;
}

function renderCount(filteredCount) {
  const total = state.items.length;
  countEl.textContent = filteredCount === total
    ? `${numberFormatter.format(total)} ${pluralize(total)}`
    : `${numberFormatter.format(filteredCount)} de ${numberFormatter.format(total)} ${pluralize(total)}`;
}

function render() {
  if (!state.loaded) return;

  const filtered = applyFilters(state.items, state.filters);
  renderCount(filtered.length);

  if (state.items.length === 0) {
    pagination.render(null);
    renderTableState(emptyState({
      icon: 'chart',
      title: 'Nenhuma resposta registrada',
      text: 'Quando o arquivo da pesquisa tiver respostas, elas vão aparecer aqui.',
    }));
    writeStateToUrl();
    return;
  }

  if (filtered.length === 0) {
    pagination.render(null);
    renderTableState(emptyState({
      icon: 'search',
      title: 'Nenhuma resposta para os filtros aplicados',
      text: 'Revise os filtros ou limpe todos para ver as respostas.',
      actions: [clearFiltersButton()],
    }));
    writeStateToUrl();
    return;
  }

  const pageInfo = paginate(filtered, state.page, state.pageSize);
  state.page = pageInfo.page;

  showTable();
  wrapper.removeAttribute('aria-busy');
  const fragment = document.createDocumentFragment();
  pageInfo.pageItems.forEach((item) => fragment.append(renderRow(item)));
  tbody.replaceChildren(fragment);
  pagination.render(pageInfo);
  writeStateToUrl();
}

// Mais recentes primeiro: "AAAA-MM-DD" + "HH:mm:ss" ordenam como texto
function newestFirst(a, b) {
  return `${b.date} ${b.hour}`.localeCompare(`${a.date} ${a.hour}`);
}

// A API pagina e só filtra por período: busca tudo em lotes e o resto acontece no navegador
async function fetchAll() {
  const first = await api.get(`api/satisfaction-surveys?page=0&size=${FETCH_SIZE}`);
  const rest = await Promise.all(Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, index) =>
    api.get(`api/satisfaction-surveys?page=${index + 1}&size=${FETCH_SIZE}`)));
  return [first, ...rest].flatMap((page) => page.itens);
}

async function loadList() {
  state.loaded = false;
  countEl.textContent = '';
  pageSizeSelect.disabled = true;
  renderLoading();

  try {
    state.items = (await fetchAll()).sort(newestFirst);
    state.loaded = true;
    pageSizeSelect.disabled = false;
    filters.setOptions(state.items, state.filters);
    render();
  } catch (error) {
    pagination.render(null);
    renderTableState(emptyState({
      icon: 'alert',
      title: 'Não foi possível carregar as respostas',
      text: error?.message || 'Verifique sua conexão e tente novamente.',
      actions: [retryButton(loadList)],
    }));
    handleError(error);
  }
}

// Ao trocar o tamanho, continua na página que contém a primeira linha que estava na tela
pageSizeSelect.value = String(state.pageSize);
pageSizeSelect.addEventListener('change', () => {
  const firstRow = (state.page - 1) * state.pageSize;
  state.pageSize = Number(pageSizeSelect.value);
  state.page = Math.floor(firstRow / state.pageSize) + 1;
  render();
});

// ── Dashboard ────────────────────────────────────────────────

// "2022-09" → "Setembro de 2022"
function monthLabel(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  const text = monthFormatter.format(new Date(year, month - 1, 1));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function fillMonths(months, selected) {
  const options = months.includes(selected) || !selected ? months : [selected, ...months];
  monthSelect.replaceChildren(...options.map((month) => el('option', { text: monthLabel(month), attrs: { value: month } })));
  monthSelect.value = selected;
  monthSelect.disabled = options.length === 0;
}

function renderKpis(data) {
  const noAnswer = data.total - data.valid;
  const satisfied = data.byGrade
    .filter((item) => item.label === '4' || item.label === '5')
    .reduce((sum, item) => sum + item.count, 0);
  const share = (count, total) => (total > 0 ? percentFormatter.format(count / total) : '—');

  dashboard.querySelector('.js-kpi-total').textContent = numberFormatter.format(data.total);
  dashboard.querySelector('.js-kpi-valid').textContent = numberFormatter.format(data.valid);
  dashboard.querySelector('.js-kpi-valid-text').textContent = `Com nota de 1 a 5 · ${share(data.valid, data.total)} do total.`;
  dashboard.querySelector('.js-kpi-satisfaction').textContent = share(satisfied, data.valid);
  dashboard.querySelector('.js-kpi-no-answer').textContent = numberFormatter.format(noAnswer);
  dashboard.querySelector('.js-kpi-no-answer-text').textContent = `Pesquisas sem nota · ${share(noAnswer, data.total)} do total.`;
}

function renderDashboardState(node) {
  dashboardContent.hidden = true;
  dashboardState.replaceChildren(node);
  dashboardState.hidden = false;
}

let dashboardLoaded = false;
let dashboardController;

async function loadDashboard() {
  dashboardController?.abort();
  dashboardController = new AbortController();
  const { signal } = dashboardController;
  dashboardLoaded = true;

  dashboardContent.setAttribute('aria-busy', 'true');
  monthSelect.disabled = true;

  try {
    const query = state.month ? `?month=${encodeURIComponent(state.month)}` : '';
    const data = await api.get(`api/satisfaction-surveys/dashboard${query}`, { signal });

    state.month = data.month;
    writeStateToUrl();
    fillMonths(data.availableMonths, data.month);
    dashboardContent.removeAttribute('aria-busy');

    if (data.total === 0) {
      renderDashboardState(emptyState({
        icon: 'chart',
        title: 'Nenhuma resposta neste mês',
        text: data.availableMonths.length
          ? 'Escolha outro mês para ver os indicadores.'
          : 'Quando o arquivo da pesquisa tiver respostas, os indicadores vão aparecer aqui.',
      }));
      return;
    }

    dashboardState.hidden = true;
    dashboardContent.hidden = false;
    renderKpis(data);
    charts.render(data);
  } catch (error) {
    if (signal.aborted) return;
    dashboardLoaded = false; // ao voltar para a aba, tenta de novo
    monthSelect.disabled = monthSelect.options.length === 0 || !monthSelect.value;
    renderDashboardState(emptyState({
      icon: 'alert',
      title: 'Não foi possível carregar o dashboard',
      text: error?.message || 'Verifique sua conexão e tente novamente.',
      actions: [retryButton(loadDashboard)],
    }));
    handleError(error);
  }
}

monthSelect.addEventListener('change', () => {
  state.month = monthSelect.value;
  loadDashboard();
});

// ── Exportar ─────────────────────────────────────────────────

// Mesmo layout do /export do backend: ";" como separador e UTF-8 com BOM para o Excel brasileiro
const CSV_COLUMNS = ['Data', 'Hora', 'Perg. 1', 'Finalizador', 'Tempo', 'Status', 'Mês', 'Dia da semana', 'Hora resposta', 'Nota'];

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvRow(item) {
  return [
    formatDate(item.date), item.hour, item.question1, item.finisher, item.time,
    item.status, item.month, item.weekDay, item.answerHour, item.grade,
  ].map(csvCell).join(';');
}

// Listagem: gera no navegador só as linhas filtradas (todos os filtros, não só o período)
function exportFiltered() {
  const rows = applyFilters(state.items, state.filters);
  const content = [CSV_COLUMNS.join(';'), ...rows.map(csvRow)].join('\r\n');
  const today = new Date().toLocaleDateString('sv-SE'); // "AAAA-MM-DD" no fuso local
  saveBlob(new Blob([`﻿${content}\r\n`], { type: 'text/csv;charset=utf-8' }), `relatorio-geral-${today}.csv`);
}

// Dashboard: o mês inteiro direto do backend
async function exportMonth() {
  const [year, month] = state.month.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const params = new URLSearchParams({ start: `${state.month}-01`, end: `${state.month}-${String(lastDay).padStart(2, '0')}` });
  const { blob, filename } = await api.download(`api/satisfaction-surveys/export?${params}`);
  saveBlob(blob, filename);
}

exportButton.addEventListener('click', async () => {
  if (exportButton.disabled) return;
  if (state.tab !== 'dashboard') {
    if (state.loaded) exportFiltered();
    return;
  }
  if (!state.month) return;

  exportButton.disabled = true;
  exportButton.classList.add('is-loading');
  try {
    await exportMonth();
  } catch (error) {
    handleError(error);
  } finally {
    exportButton.disabled = false;
    exportButton.classList.remove('is-loading');
  }
});

// ── Abas e carga inicial ─────────────────────────────────────

const tabs = initTabs(document.querySelector('.js-survey-tabs'), {
  onChange(key) {
    state.tab = key;
    writeStateToUrl();
    // O dashboard só carrega na primeira visita à aba: quem só usa a listagem não paga pelos gráficos
    if (key === 'dashboard' && !dashboardLoaded) loadDashboard();
  },
});

tabs.select(state.tab);
loadList();
