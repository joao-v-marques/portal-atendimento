import { initAppShell } from '../components/app-shell.js';
import { emptyState } from '../components/authorization-table.js';
import { initConfirmDialog } from '../components/confirm-dialog.js';
import { PAGE_SIZE, initPagination, paginate } from '../components/pagination.js';
import { initProcedureDialog } from '../components/procedure-dialog.js';
import { DEFAULT_SORT, SORTABLE_KEYS, initProcedureTable, nextSort, sortItems } from '../components/procedure-table.js';
import { ApiRequestError, api } from '../core/api.js';
import { debounce, el } from '../core/dom.js';
import { handleError } from '../core/errors.js';
import { onlyDigits } from '../core/format.js';
import { notify } from '../core/notify.js';

const ENDPOINT = 'api/authorization-types';

const SITUATIONS = ['todos', 'ativos', 'inativos'];
const DEADLINES = ['todos', 'imediato', 'dias'];
const DEFAULT_FILTERS = { busca: '', prazo: 'todos', situacao: 'todos' };

const numberFormatter = new Intl.NumberFormat('pt-BR');

const results = document.querySelector('.js-results');
const countEl = results.querySelector('.js-results-count');
const filtersForm = document.querySelector('.js-filters');
const clearFiltersButton = filtersForm.querySelector('.js-clear-filters');
const searchField = filtersForm.elements.namedItem('busca');

// ── Estado (espelhado na query string) ───────────────────────

function readStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const situacao = params.get('situacao');
  const prazo = params.get('prazo');
  const [key, direction] = (params.get('ordem') ?? '').split(':');
  const sort = SORTABLE_KEYS.includes(key) && (direction === 'asc' || direction === 'desc')
    ? { key, direction }
    : DEFAULT_SORT;

  return {
    filters: {
      busca: params.get('busca') ?? '',
      prazo: DEADLINES.includes(prazo) ? prazo : DEFAULT_FILTERS.prazo,
      situacao: SITUATIONS.includes(situacao) ? situacao : DEFAULT_FILTERS.situacao,
    },
    sort,
    page: Math.max(1, Number(params.get('pagina')) || 1),
  };
}

// replaceState: F5 e link compartilhado mantêm a busca sem encher o histórico a cada tecla
function writeStateToUrl({ filters, sort, page }) {
  const params = new URLSearchParams();
  if (filters.busca) params.set('busca', filters.busca);
  if (filters.prazo !== DEFAULT_FILTERS.prazo) params.set('prazo', filters.prazo);
  if (filters.situacao !== DEFAULT_FILTERS.situacao) params.set('situacao', filters.situacao);
  if (sort.key !== DEFAULT_SORT.key || sort.direction !== DEFAULT_SORT.direction) params.set('ordem', `${sort.key}:${sort.direction}`);
  if (page > 1) params.set('pagina', String(page));
  const query = params.toString();
  window.history.replaceState(null, '', query ? `${window.location.pathname}?${query}` : window.location.pathname);
}

const state = {
  ...readStateFromUrl(),
  items: [],
  itemsById: new Map(),
  loaded: false,
};

// ── Filtros ──────────────────────────────────────────────────

/** Busca sem acento e sem caixa: "ressonancia" encontra "Ressonância" */
function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function withSearchIndex(item) {
  return { ...item, code: String(item.code ?? ''), search: normalize(item.name) };
}

function hasActiveFilters({ busca, prazo, situacao }) {
  return Boolean(busca) || prazo !== DEFAULT_FILTERS.prazo || situacao !== DEFAULT_FILTERS.situacao;
}

/**
 * Só números (com ou sem pontos, como "1.01.01"): busca pelo início do código.
 * Com letras: todas as palavras precisam aparecer no nome (ou no início do código).
 */
function applyFilters(items, { busca, prazo, situacao }) {
  const term = normalize(busca).trim();
  const isCodeSearch = term !== '' && /^[\d.\s-]+$/.test(term);
  const digits = isCodeSearch ? onlyDigits(term) : '';
  const words = isCodeSearch ? [] : term.split(/\s+/).filter(Boolean);

  return items.filter((item) => {
    if (situacao === 'ativos' && !item.isActive) return false;
    if (situacao === 'inativos' && item.isActive) return false;
    if (prazo === 'imediato' && item.maxDays !== 0) return false;
    if (prazo === 'dias' && item.maxDays === 0) return false;
    if (isCodeSearch) return item.code.startsWith(digits);
    return words.every((word) => item.search.includes(word) || item.code.startsWith(word));
  });
}

function readFilters() {
  return {
    busca: String(searchField.value).trim(),
    prazo: filtersForm.elements.namedItem('prazo').value,
    situacao: filtersForm.elements.namedItem('situacao').value,
  };
}

function fillFilters({ busca, prazo, situacao }) {
  searchField.value = busca;
  filtersForm.elements.namedItem('prazo').value = prazo;
  filtersForm.elements.namedItem('situacao').value = situacao;
}

function applyFilterChange() {
  state.filters = readFilters();
  state.page = 1;
  clearFiltersButton.hidden = !hasActiveFilters(state.filters);
  render();
}

const applyFilterChangeDebounced = debounce(applyFilterChange, 250);

// ── Componentes ──────────────────────────────────────────────

initAppShell().catch(() => {}); // erros do usuário logado já são tratados no shell

const table = initProcedureTable(results, {
  onSort(key) {
    state.sort = nextSort(state.sort, key);
    table.setSort(state.sort);
    render();
  },
  onEdit(id, opener) {
    const item = state.itemsById.get(id);
    if (item) procedureDialog.open({ item, opener });
  },
  onToggleActive(id, opener) {
    const item = state.itemsById.get(id);
    if (item) toggleActive(item, opener);
  },
});

const pagination = initPagination(results.querySelector('.js-pagination'), {
  onChange(page) {
    state.page = page;
    render();
    table.focusResults();
  },
});

const confirmDialog = initConfirmDialog(document.querySelector('.js-confirm-dialog'));

const procedureDialog = initProcedureDialog(document.querySelector('.js-procedure-dialog'), {
  onSaved(saved, mode) {
    const item = replaceItem(saved, mode === 'create');

    // Linha trocada no lugar quando já está na página e continua no filtro; senão a tabela inteira
    const stillVisible = applyFilters([item], state.filters).length > 0;
    if (mode === 'edit' && stillVisible && table.replaceRow(item)) {
      updateCount(applyFilters(state.items, state.filters).length);
      table.focusRowAction(item.id, '.js-edit-item');
      return;
    }

    // Novo procedimento: vai para a página dele, para a pessoa ver o que acabou de cadastrar
    if (mode === 'create' && stillVisible) {
      const sorted = sortItems(applyFilters(state.items, state.filters), state.sort);
      state.page = Math.floor(sorted.findIndex((entry) => entry.id === item.id) / PAGE_SIZE) + 1;
    }

    render();
    if (!table.focusRowAction(item.id, '.js-edit-item')) table.focusResults();
  },
});

function replaceItem(raw, isNew = false) {
  const item = withSearchIndex(raw);
  if (isNew) {
    state.items.push(item);
  } else {
    const index = state.items.findIndex((entry) => entry.id === item.id);
    if (index >= 0) state.items[index] = item;
  }
  state.itemsById.set(item.id, item);
  return item;
}

// ── Ativar / desativar ───────────────────────────────────────

async function toggleActive(item, opener) {
  if (item.isActive) {
    const confirmed = await confirmDialog.ask({
      title: 'Desativar procedimento?',
      description: `O procedimento ${item.code} (${item.name}) deixa de aparecer ao lançar autorizações. `
        + 'As autorizações que já usam este procedimento não mudam, e você pode reativá-lo depois.',
      confirmLabel: 'Desativar procedimento',
      opener,
    });
    if (!confirmed) return;
  }

  const action = item.isActive ? 'deactivate' : 'reactivate';
  try {
    const updated = replaceItem(await api.patch(`${ENDPOINT}/${encodeURIComponent(item.id)}/${action}`));
    notify.success(`Procedimento ${updated.code} ${updated.isActive ? 'reativado' : 'desativado'}.`);

    // Fora do filtro atual a linha sai da tabela; dentro dele, só a linha muda
    const stillVisible = applyFilters([updated], state.filters).length > 0;
    if (stillVisible && table.replaceRow(updated)) {
      updateCount(applyFilters(state.items, state.filters).length);
      // O rótulo mudou de Desativar para Reativar, então o nó anterior já não existe
      table.focusRowAction(updated.id, '.js-toggle-active');
      return;
    }

    render();
    table.focusResults();
  } catch (error) {
    handleError(error);
  }
}

// ── Renderização ─────────────────────────────────────────────

function updateCount(filteredTotal) {
  const total = state.items.length;
  const noun = (n) => (n === 1 ? 'procedimento' : 'procedimentos');
  countEl.textContent = filteredTotal === total
    ? `${numberFormatter.format(total)} ${noun(total)}`
    : `${numberFormatter.format(filteredTotal)} de ${numberFormatter.format(total)} ${noun(total)}`;
}

function clearFiltersAction() {
  filtersForm.reset();
  fillFilters(DEFAULT_FILTERS);
  applyFilterChange();
  searchField.focus();
}

function buttonNode(className, text, onClick) {
  const button = el('button', { className: `c-button ${className}`, text, attrs: { type: 'button' } });
  button.addEventListener('click', onClick);
  return button;
}

function render() {
  if (!state.loaded) return;

  const filtered = applyFilters(state.items, state.filters);
  updateCount(filtered.length);

  if (state.items.length === 0) {
    pagination.render(null);
    table.renderState(emptyState({
      icon: 'clipboard',
      title: 'Nenhum procedimento cadastrado',
      text: 'Cadastre o primeiro para ele aparecer ao lançar uma autorização.',
      actions: [buttonNode('c-button--primary', 'Novo procedimento', (event) => procedureDialog.open({ opener: event.currentTarget }))],
    }));
    writeStateToUrl(state);
    return;
  }

  if (filtered.length === 0) {
    pagination.render(null);
    table.renderState(emptyState({
      icon: 'search',
      title: 'Nenhum procedimento encontrado',
      text: 'Confira o código ou o nome digitado, ou limpe os filtros para ver todos.',
      actions: [buttonNode('c-button--secondary', 'Limpar filtros', clearFiltersAction)],
    }));
    writeStateToUrl(state);
    return;
  }

  const pageInfo = paginate(sortItems(filtered, state.sort), state.page);
  state.page = pageInfo.page;
  table.renderRows(pageInfo.pageItems);
  pagination.render(pageInfo);
  writeStateToUrl(state);
}

function renderLoadError(error) {
  countEl.textContent = '';
  pagination.render(null);

  if (error instanceof ApiRequestError && error.status === 403) {
    table.renderState(emptyState({
      icon: 'alert',
      title: 'Sem permissão',
      text: 'Você não tem permissão para ver os procedimentos. Fale com um administrador.',
    }));
    return;
  }

  table.renderState(emptyState({
    icon: 'alert',
    title: 'Não foi possível carregar os procedimentos',
    text: 'Verifique sua conexão e tente novamente.',
    actions: [buttonNode('c-button--secondary', 'Tentar novamente', load)],
  }));
}

// ── Carregamento ─────────────────────────────────────────────

async function load() {
  table.renderLoading();
  countEl.textContent = '';

  try {
    state.items = (await api.get(ENDPOINT)).map(withSearchIndex);
  } catch (error) {
    renderLoadError(error);
    handleError(error);
    return;
  }

  state.itemsById = new Map(state.items.map((item) => [item.id, item]));
  state.loaded = true;
  render();
}

// ── Inicialização ────────────────────────────────────────────

fillFilters(state.filters);
clearFiltersButton.hidden = !hasActiveFilters(state.filters);
table.setSort(state.sort);

filtersForm.addEventListener('input', (event) => {
  if (event.target === searchField) applyFilterChangeDebounced();
});

filtersForm.addEventListener('change', (event) => {
  if (event.target !== searchField) applyFilterChange();
});

// Enter na busca aplica na hora, sem esperar o debounce
filtersForm.addEventListener('submit', (event) => {
  event.preventDefault();
  applyFilterChange();
});

clearFiltersButton.addEventListener('click', clearFiltersAction);

document.querySelector('.js-new-item').addEventListener('click', (event) => {
  procedureDialog.open({ opener: event.currentTarget });
});

// Atalho "/" foca a busca (ignorado enquanto a pessoa digita em outro campo ou há modal aberto)
document.addEventListener('keydown', (event) => {
  if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  const isTyping = target instanceof Element && target.closest('input, select, textarea, [contenteditable="true"]');
  if (isTyping || document.querySelector('dialog[open]')) return;
  event.preventDefault();
  searchField.focus();
});

load();
