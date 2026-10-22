import { initAppShell } from '../components/app-shell.js';
import { emptyState } from '../components/authorization-table.js';
import { initConfirmDialog } from '../components/confirm-dialog.js';
import { DEFAULT_LOOKUP_SECTION, agree, lookupBySection } from '../components/lookup-config.js';
import { initLookupDialog } from '../components/lookup-dialog.js';
import { defaultSort, initLookupTable, nextSort, sortItems, sortableKeys } from '../components/lookup-table.js';
import { initPagination, paginate } from '../components/pagination.js';
import { initSettingsNav } from '../components/settings-nav.js';
import { ApiRequestError, api } from '../core/api.js';
import { debounce, el } from '../core/dom.js';
import { handleError } from '../core/errors.js';
import { notify } from '../core/notify.js';

const SITUATIONS = ['ativos', 'inativos', 'todos'];
const DEFAULT_SITUATION = 'todos';

const numberFormatter = new Intl.NumberFormat('pt-BR');

// ── Seção ativa ──────────────────────────────────────────────
// A troca de seção é uma navegação completa (como em /configuracoes): só o painel ativo
// é ligado e só o cadastro dele é carregado

const nav = document.querySelector('.js-settings-nav');
const panels = [...document.querySelectorAll('.js-panel')];
const { section } = initSettingsNav(nav, panels, DEFAULT_LOOKUP_SECTION);
const lookup = lookupBySection(section);

const panel = panels.find((node) => node.dataset.section === section);
const results = panel.querySelector('.js-results');
const countEl = panel.querySelector('.js-results-count');
const filtersForm = panel.querySelector('.js-filters');
const clearFiltersButton = filtersForm.querySelector('.js-clear-filters');
const searchField = filtersForm.elements.namedItem('busca');

// ── Estado (espelhado na query string) ───────────────────────

function readStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const situacao = params.get('situacao');
  const [key, direction] = (params.get('ordem') ?? '').split(':');
  const sort = sortableKeys(lookup).includes(key) && (direction === 'asc' || direction === 'desc')
    ? { key, direction }
    : defaultSort(lookup);

  return {
    filters: {
      busca: params.get('busca') ?? '',
      situacao: SITUATIONS.includes(situacao) ? situacao : DEFAULT_SITUATION,
    },
    sort,
    page: Math.max(1, Number(params.get('pagina')) || 1),
  };
}

// replaceState: F5 e link compartilhado mantêm a busca sem encher o histórico a cada tecla
function writeStateToUrl({ filters, sort, page }) {
  const params = new URLSearchParams();
  params.set('secao', section);
  if (filters.busca) params.set('busca', filters.busca);
  if (filters.situacao !== DEFAULT_SITUATION) params.set('situacao', filters.situacao);
  const fallback = defaultSort(lookup);
  if (sort.key !== fallback.key || sort.direction !== fallback.direction) params.set('ordem', `${sort.key}:${sort.direction}`);
  if (page > 1) params.set('pagina', String(page));
  window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
}

const state = {
  ...readStateFromUrl(),
  items: [],
  itemsById: new Map(),
  loaded: false,
};

// ── Filtros ──────────────────────────────────────────────────

/** Busca sem acento e sem caixa: "reclamacao" encontra "Reclamação" */
function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function hasActiveFilters({ busca, situacao }) {
  return Boolean(busca) || situacao !== DEFAULT_SITUATION;
}

function applyFilters(items, { busca, situacao }) {
  const term = normalize(busca).trim();
  return items.filter((item) => {
    if (situacao === 'ativos' && !item.isActive) return false;
    if (situacao === 'inativos' && item.isActive) return false;
    return !term || normalize(item.name).includes(term);
  });
}

function readFilters() {
  return {
    busca: String(searchField.value).trim(),
    situacao: filtersForm.elements.namedItem('situacao').value,
  };
}

function fillFilters({ busca, situacao }) {
  searchField.value = busca;
  filtersForm.elements.namedItem('situacao').value = situacao;
}

function applyFilterChange() {
  state.filters = readFilters();
  state.page = 1;
  clearFiltersButton.hidden = !hasActiveFilters(state.filters);
  render();
}

const applyFilterChangeDebounced = debounce(applyFilterChange, 300);

// ── Componentes ──────────────────────────────────────────────

initAppShell().catch(() => {}); // erros do usuário logado já são tratados no shell

const table = initLookupTable(results, lookup, {
  onSort(key) {
    state.sort = nextSort(state.sort, key);
    table.setSort(state.sort);
    render();
  },
  onEdit(id, opener) {
    const item = state.itemsById.get(id);
    if (item) lookupDialog.open({ lookup, item, opener });
  },
  onToggleActive(id, opener) {
    const item = state.itemsById.get(id);
    if (item) toggleActive(item, opener);
  },
});

const pagination = initPagination(panel.querySelector('.js-pagination'), {
  onChange(page) {
    state.page = page;
    render();
    table.focusResults();
  },
});

const confirmDialog = initConfirmDialog(document.querySelector('.js-confirm-dialog'));

const lookupDialog = initLookupDialog(document.querySelector('.js-lookup-dialog'), {
  onSaved(saved, mode) {
    replaceItem(saved, mode === 'create');

    // Linha trocada no lugar quando já está na página; senão a tabela inteira
    if (mode === 'edit' && table.replaceRow(saved)) {
      updateCount(applyFilters(state.items, state.filters).length);
      table.focusRowAction(saved.id, '.js-edit-item');
      return;
    }

    render();
    if (!table.focusRowAction(saved.id, '.js-edit-item')) table.focusResults();
  },
});

function replaceItem(item, isNew = false) {
  if (isNew) {
    state.items.push(item);
  } else {
    const index = state.items.findIndex((entry) => entry.id === item.id);
    if (index >= 0) state.items[index] = item;
  }
  state.itemsById.set(item.id, item);
}

// ── Ativar / desativar ───────────────────────────────────────

async function toggleActive(item, opener) {
  if (item.isActive) {
    const confirmed = await confirmDialog.ask({
      title: `Desativar ${lookup.singular}?`,
      description: `${item.name} deixa de aparecer como opção ao registrar e editar atendimentos. `
        + 'Os atendimentos que já usam este cadastro não mudam, e você pode reativar depois.',
      confirmLabel: `Desativar ${lookup.singular}`,
      opener,
    });
    if (!confirmed) return;
  }

  const action = item.isActive ? 'deactivate' : 'reactivate';
  try {
    const updated = await api.patch(`${lookup.endpoint}/${encodeURIComponent(item.id)}/${action}`);
    replaceItem(updated);
    notify.success(`${item.name}: ${lookup.singular} ${agree(lookup, updated.isActive ? 'reativado' : 'desativado')}.`);

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

function updateCount(total) {
  countEl.textContent = total === 1 ? '1 cadastro' : `${numberFormatter.format(total)} cadastros`;
}

function clearFiltersAction() {
  filtersForm.reset();
  fillFilters({ busca: '', situacao: DEFAULT_SITUATION });
  applyFilterChange();
  searchField.focus();
}

function clearFiltersButtonNode() {
  const button = el('button', { className: 'c-button c-button--secondary', text: 'Limpar filtros', attrs: { type: 'button' } });
  button.addEventListener('click', clearFiltersAction);
  return button;
}

function newItemButtonNode() {
  const button = el('button', { className: 'c-button c-button--primary', text: lookup.newLabel, attrs: { type: 'button' } });
  button.addEventListener('click', (event) => lookupDialog.open({ lookup, opener: event.currentTarget }));
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
      title: `Nenhum${lookup.feminine ? 'a' : ''} ${lookup.singular} cadastrad${lookup.feminine ? 'a' : 'o'}`,
      text: 'Cadastre o primeiro para ele aparecer no registro de atendimentos.',
      actions: [newItemButtonNode()],
    }));
    writeStateToUrl(state);
    return;
  }

  if (filtered.length === 0) {
    pagination.render(null);
    table.renderState(emptyState({
      icon: 'search',
      title: 'Nenhum resultado para os filtros aplicados',
      text: 'Revise a busca ou limpe os filtros para ver todos os cadastros.',
      actions: [clearFiltersButtonNode()],
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
      text: 'Você não tem permissão para ver estes cadastros. Fale com um administrador.',
    }));
    return;
  }

  const retry = el('button', { className: 'c-button c-button--secondary', text: 'Tentar novamente', attrs: { type: 'button' } });
  retry.addEventListener('click', load);

  table.renderState(emptyState({
    icon: 'alert',
    title: 'Não foi possível carregar os cadastros',
    text: 'Verifique sua conexão e tente novamente.',
    actions: [retry],
  }));
}

// ── Carregamento ─────────────────────────────────────────────

async function load() {
  table.renderLoading();
  countEl.textContent = '';

  try {
    state.items = await api.get(lookup.endpoint);
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

panel.querySelector('.js-new-item').addEventListener('click', (event) => {
  lookupDialog.open({ lookup, opener: event.currentTarget });
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
