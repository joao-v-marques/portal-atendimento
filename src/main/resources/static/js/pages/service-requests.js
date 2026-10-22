import { initAppShell } from '../components/app-shell.js';
import { populateSelect } from '../components/authorization-filters.js';
import { emptyState } from '../components/authorization-table.js';
import { initConfirmDialog } from '../components/confirm-dialog.js';
import { initPagination, paginate } from '../components/pagination.js';
import { initServiceRequestDetailDialog } from '../components/service-request-detail-dialog.js';
import { initServiceRequestEditDialog } from '../components/service-request-edit-dialog.js';
import { FILTER_KEYS, applyFilters, fillFilters, initFilters } from '../components/service-request-filters.js';
import { initServiceRequestFinishDialog } from '../components/service-request-finish-dialog.js';
import {
  DEFAULT_SORT,
  SORTABLE_KEYS,
  initServiceRequestTable,
  nextSort,
  sortItems,
} from '../components/service-request-table.js';
import { api } from '../core/api.js';
import { el } from '../core/dom.js';
import { handleError } from '../core/errors.js';
import { notify } from '../core/notify.js';

const numberFormatter = new Intl.NumberFormat('pt-BR');

const form = document.querySelector('.js-filters');
const results = document.querySelector('.js-results');
const countEl = document.querySelector('.js-results-count');

// ── Estado (espelhado na query string) ───────────────────────

function readStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? '']));
  const [key, direction] = (params.get('ordem') ?? '').split(':');
  const sort = SORTABLE_KEYS.includes(key) && (direction === 'asc' || direction === 'desc')
    ? { key, direction }
    : DEFAULT_SORT;
  const page = Number.parseInt(params.get('pagina') ?? '', 10) || 1;
  return { filters, sort, page };
}

// replaceState: F5 e link compartilhado mantêm a busca sem encher o histórico a cada tecla
function writeStateToUrl({ filters, sort, page }) {
  const params = new URLSearchParams();
  FILTER_KEYS.forEach((key) => { if (filters[key]) params.set(key, filters[key]); });
  if (sort.key !== DEFAULT_SORT.key || sort.direction !== DEFAULT_SORT.direction) params.set('ordem', `${sort.key}:${sort.direction}`);
  if (page > 1) params.set('pagina', String(page));
  const query = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
}

const state = {
  ...readStateFromUrl(),
  items: [],
  itemsById: new Map(),
  loaded: false,
};

// ── Componentes ──────────────────────────────────────────────

initAppShell().catch(() => {}); // erros do usuário logado já são tratados no shell

const editDialog = initServiceRequestEditDialog(document.querySelector('.js-edit-dialog'), {
  onSaved: replaceItem,
});

const finishDialog = initServiceRequestFinishDialog(document.querySelector('.js-finish-dialog'), {
  onFinished: replaceItem,
});

const reopenDialog = initConfirmDialog(document.querySelector('.js-reopen-dialog'));

const detailDialog = initServiceRequestDetailDialog(document.querySelector('.js-detail-dialog'), {
  onEdit: (item, opener) => editDialog.open(item, opener),
  onFinish: (item, opener) => finishDialog.open(item, opener),
  onReopen: (item, opener) => reopenServiceRequest(item, opener),
});

const table = initServiceRequestTable(results, {
  onSort(key) {
    state.sort = nextSort(state.sort, key);
    state.page = 1;
    render();
  },
  onView: (id, opener) => detailDialog.open(state.itemsById.get(id), opener),
  onEdit: (id, opener) => editDialog.open(state.itemsById.get(id), opener),
  onFinish: (id, opener) => finishDialog.open(state.itemsById.get(id), opener),
  onReopen: (id, opener) => reopenServiceRequest(state.itemsById.get(id), opener),
});

const pagination = initPagination(document.querySelector('.js-pagination'), {
  onChange(page) {
    state.page = page;
    render();
    table.focusResults();
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

// ── Renderização ─────────────────────────────────────────────

function pluralize(count) {
  return count === 1 ? 'atendimento' : 'atendimentos';
}

function renderCount(filteredCount) {
  const total = state.items.length;
  countEl.textContent = filteredCount === total
    ? `${numberFormatter.format(total)} ${pluralize(total)}`
    : `${numberFormatter.format(filteredCount)} de ${numberFormatter.format(total)} ${pluralize(total)}`;
}

function clearFiltersButton() {
  const button = el('button', { className: 'c-button c-button--secondary', attrs: { type: 'button' } }, [
    el('span', { className: 'c-icon c-icon--sm c-icon--filter-x', attrs: { 'aria-hidden': 'true' } }),
    'Limpar filtros',
  ]);
  button.addEventListener('click', filters.clear);
  return button;
}

function render() {
  if (!state.loaded) return;

  const filtered = applyFilters(state.items, state.filters);
  renderCount(filtered.length);
  table.setSort(state.sort);

  if (state.items.length === 0) {
    pagination.render(null);
    table.renderState(emptyState({
      icon: 'clipboard',
      title: 'Nenhum atendimento registrado',
      text: 'Quando um atendimento for registrado, ele vai aparecer aqui.',
    }));
    writeStateToUrl(state);
    return;
  }

  if (filtered.length === 0) {
    pagination.render(null);
    table.renderState(emptyState({
      icon: 'search',
      title: 'Nenhum resultado para os filtros aplicados',
      text: 'Revise a busca ou limpe os filtros para ver todos os atendimentos.',
      actions: [clearFiltersButton()],
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
  const retry = el('button', { className: 'c-button c-button--secondary', text: 'Tentar novamente', attrs: { type: 'button' } });
  retry.addEventListener('click', load);
  table.renderState(emptyState({
    icon: 'clipboard',
    title: 'Não foi possível carregar os atendimentos',
    text: 'Verifique sua conexão e tente novamente.',
    actions: [retry],
  }));
  handleError(error);
}

// ── Ações ────────────────────────────────────────────────────

// Troca o item atualizado na lista e devolve o foco à linha. Os botões mudam com o status,
// então o foco vai para o Detalhar dela ou, se a linha saiu do filtro, para os resultados
function replaceItem(updated) {
  const index = state.items.findIndex((entry) => entry.id === updated.id);
  if (index >= 0) state.items[index] = updated;
  state.itemsById.set(updated.id, updated);

  render();
  if (!table.focusRowAction(updated.id, '.js-view')) table.focusResults();
}

async function reopenServiceRequest(item, opener) {
  if (!item) return;

  const confirmed = await reopenDialog.ask({
    title: `Reabrir o atendimento ${item.protocolNumber}?`,
    description: `O atendimento de ${item.requesterName || 'solicitante não informado'} volta para Em andamento `
      + 'e poderá ser editado e finalizado de novo. A resolução atual é mantida até a próxima finalização.',
    confirmLabel: 'Reabrir atendimento',
    opener,
  });
  if (!confirmed) return;

  opener?.classList.add('is-loading');
  if (opener) opener.disabled = true;
  try {
    const reopened = await api.patch(`api/service-requests/${encodeURIComponent(item.id)}/reopen`);
    notify.success(`Atendimento ${reopened.protocolNumber} reaberto.`);
    replaceItem(reopened);
  } catch (error) {
    if (opener) opener.disabled = false;
    opener?.classList.remove('is-loading');
    handleError(error);
  }
}

// ── Dados ────────────────────────────────────────────────────

async function load() {
  countEl.textContent = 'Carregando atendimentos…';
  table.renderLoading();

  // allSettled: se só os auxiliares falharem, a lista ainda aparece
  const [requests, categories, channels, types, severities, statuses] = await Promise.allSettled([
    api.get('api/service-requests'),
    api.get('api/service-request-categories'),
    api.get('api/service-request-channels'),
    api.get('api/service-request-types'),
    api.get('api/service-request-severities'),
    api.get('api/service-request-status'),
  ]);

  if (requests.status === 'rejected') {
    renderLoadError(requests.reason);
    return;
  }

  state.items = requests.value;
  state.itemsById = new Map(state.items.map((item) => [item.id, item]));
  state.loaded = true;

  const valueOf = (result) => (result.status === 'fulfilled' ? result.value : []);
  editDialog.setLookups({
    categories: valueOf(categories),
    channels: valueOf(channels),
    types: valueOf(types),
    severities: valueOf(severities),
    statuses: valueOf(statuses),
  });

  // Falha nos auxiliares afeta a edição (selects sem opções), então avisa uma vez
  if ([categories, channels, types, severities, statuses].some((result) => result.status === 'rejected')) {
    notify.error('Alguns cadastros não carregaram. A edição pode ficar incompleta; recarregue a página.');
  }

  // Opções = cadastro oficial + nomes presentes na lista (inclui valores já desativados)
  const names = (result) => valueOf(result).map((entry) => entry.name);
  populateSelect(form.elements.namedItem('status'),
    [...names(statuses), ...state.items.map((item) => item.statusName)], state.filters.status);
  populateSelect(form.elements.namedItem('tipo'),
    [...names(types), ...state.items.map((item) => item.typeName)], state.filters.tipo);
  populateSelect(form.elements.namedItem('categoria'),
    [...names(categories), ...state.items.map((item) => item.categoryName)], state.filters.categoria);
  populateSelect(form.elements.namedItem('responsavel'),
    state.items.map((item) => item.assignedToName), state.filters.responsavel);

  render();
}

load();
