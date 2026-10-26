import { initAppShell } from '../components/app-shell.js';
import { descriptionItem, initAuthorizationDetailDialog } from '../components/authorization-detail-dialog.js';
import {
  FILTER_KEYS,
  applyFilters,
  fillFilters,
  initFilters,
  populateSelect,
} from '../components/authorization-filters.js';
import {
  DEFAULT_SORT,
  SORTABLE_KEYS,
  deadlineLevel,
  emptyState,
  initAuthorizationTable,
  nextSort,
  sortItems,
} from '../components/authorization-table.js';
import { initConfirmDialog } from '../components/confirm-dialog.js';
import { initPagination, paginate } from '../components/pagination.js';
import { api } from '../core/api.js';
import { el } from '../core/dom.js';
import { handleError } from '../core/errors.js';
import { businessDaysSince, formatDate, formatPhone } from '../core/format.js';
import { notify } from '../core/notify.js';

const numberFormatter = new Intl.NumberFormat('pt-BR');

const form = document.querySelector('.js-filters');
const results = document.querySelector('.js-results');
const countEl = document.querySelector('.js-results-count');
const deadlineCards = document.querySelector('.js-deadline-cards');
const warningCard = deadlineCards.querySelector('.js-card-warning');
const overdueCard = deadlineCards.querySelector('.js-card-overdue');
const finishDialogEl = document.querySelector('.js-finish-dialog');
const finishDetails = finishDialogEl.querySelector('.js-finish-details');

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

const detailDialog = initAuthorizationDetailDialog(document.querySelector('.js-detail-dialog'));

const table = initAuthorizationTable(results, {
  onSort(key) {
    state.sort = nextSort(state.sort, key);
    state.page = 1;
    render();
  },
  onView(id, opener) {
    detailDialog.open(state.itemsById.get(id), opener);
  },
  onFinish(id, opener) {
    finishAuthorization(state.itemsById.get(id), opener);
  },
  onReopen(id, opener) {
    reopenAuthorization(state.itemsById.get(id), opener);
  },
});

const finishDialog = initConfirmDialog(finishDialogEl);

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

// Atalho dos cards: só aquele grupo, mais antigas (mais urgentes) primeiro
function showDeadlineGroup(prazo) {
  state.sort = { key: 'requestDate', direction: 'asc' };
  filters.replace({ prazo });
  table.focusResults();
}

warningCard.querySelector('.js-warning-action').addEventListener('click', () => showDeadlineGroup('avencer'));
overdueCard.querySelector('.js-overdue-action').addEventListener('click', () => showDeadlineGroup('vencida'));

// ── Renderização ─────────────────────────────────────────────

function pluralize(count) {
  return count === 1 ? 'autorização' : 'autorizações';
}

function renderCount(filteredCount) {
  const total = state.items.length;
  countEl.textContent = filteredCount === total
    ? `${numberFormatter.format(total)} ${pluralize(total)}`
    : `${numberFormatter.format(filteredCount)} de ${numberFormatter.format(total)} ${pluralize(total)}`;
}

// Conta a lista inteira, não a filtrada: filtro ou paginação não podem esconder um prazo da ANS em risco
function renderDeadlineCards() {
  const levels = state.items.map(deadlineLevel);
  const warning = levels.filter((level) => level === 'warning').length;
  const overdue = levels.filter((level) => level === 'overdue').length;

  warningCard.querySelector('.js-warning-count').textContent = numberFormatter.format(warning);
  overdueCard.querySelector('.js-overdue-count').textContent = numberFormatter.format(overdue);
  // Sempre visíveis, mesmo zerados; só some no erro de carga (renderLoadError) e volta no retry
  deadlineCards.hidden = false;
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
      title: 'Nenhuma autorização cadastrada',
      text: 'Quando uma autorização for registrada, ela vai aparecer aqui.',
    }));
    writeStateToUrl(state);
    return;
  }

  if (filtered.length === 0) {
    pagination.render(null);
    table.renderState(emptyState({
      icon: 'search',
      title: 'Nenhum resultado para os filtros aplicados',
      text: 'Revise a busca ou limpe os filtros para ver todas as autorizações.',
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
  deadlineCards.hidden = true;
  pagination.render(null);
  const retry = el('button', { className: 'c-button c-button--secondary', text: 'Tentar novamente', attrs: { type: 'button' } });
  retry.addEventListener('click', load);
  table.renderState(emptyState({
    icon: 'clipboard',
    title: 'Não foi possível carregar as autorizações',
    text: 'Verifique sua conexão e tente novamente.',
    actions: [retry],
  }));
  handleError(error);
}

// ── Finalizar ────────────────────────────────────────────────

function elapsedText(requestDate) {
  const days = businessDaysSince(requestDate);
  if (days === null) return '—';
  return `${formatDate(requestDate)} (há ${days} ${days === 1 ? 'dia útil' : 'dias úteis'})`;
}

async function finishAuthorization(item, opener) {
  if (!item) return;

  finishDetails.replaceChildren(
    descriptionItem('Nº da transação', item.transactionNumber),
    descriptionItem('Beneficiário', item.beneficiaryName),
    descriptionItem('Telefone', formatPhone(item.beneficiaryPhone)),
    descriptionItem('Tipo', item.authorizationTypeName),
    descriptionItem('Status atual', item.authorizationStatusName),
    descriptionItem('Solicitada em', elapsedText(item.requestDate)),
  );

  const confirmed = await finishDialog.ask({
    title: `Finalizar a autorização ${item.transactionNumber}?`,
    description: `A autorização de ${item.beneficiaryName || 'beneficiário não informado'} será marcada como finalizada `
      + 'e deixará de contar no prazo da ANS. Não é possível desfazer essa ação pelo portal.',
    confirmLabel: 'Finalizar autorização',
    opener,
  });
  if (!confirmed) return;

  opener.disabled = true;
  opener.classList.add('is-loading');
  try {
    const updated = await api.patch(`api/authorization-requests/${encodeURIComponent(item.id)}/finish`);

    const index = state.items.findIndex((entry) => entry.id === updated.id);
    if (index >= 0) state.items[index] = updated;
    state.itemsById.set(updated.id, updated);

    notify.success(`Autorização ${updated.transactionNumber} finalizada.`);
    renderDeadlineCards();
    render();

    // O botão Finalizar sumiu da linha: o foco vai para o Detalhes dela ou, se a linha
    // saiu do filtro (ex.: prazo vencido), para os resultados — senão cairia no <body>
    if (!table.focusRowAction(updated.id, '.js-view')) table.focusResults();
  } catch (error) {
    opener.disabled = false;
    opener.classList.remove('is-loading');
    handleError(error);
  }
}

// ── Reabrir ──────────────────────────────────────────────────

async function reopenAuthorization(item, opener) {
  if (!item) return;

  finishDetails.replaceChildren(
    descriptionItem('Nº da transação', item.transactionNumber),
    descriptionItem('Beneficiário', item.beneficiaryName),
    descriptionItem('Tipo', item.authorizationTypeName),
    descriptionItem('Status atual', item.authorizationStatusName),
    descriptionItem('Finalizada em', formatDate(item.finishDate)),
  );

  // Mesmo diálogo do Finalizar: título, descrição e botão são trocados a cada ask
  const confirmed = await finishDialog.ask({
    title: `Reabrir a autorização ${item.transactionNumber}?`,
    description: `A autorização de ${item.beneficiaryName || 'beneficiário não informado'} voltará a ficar em aberto `
      + 'e a contar no prazo da ANS. A data de finalização será removida.',
    confirmLabel: 'Reabrir autorização',
    opener,
  });
  if (!confirmed) return;

  opener.disabled = true;
  opener.classList.add('is-loading');
  try {
    const updated = await api.patch(`api/authorization-requests/${encodeURIComponent(item.id)}/reopen`);

    const index = state.items.findIndex((entry) => entry.id === updated.id);
    if (index >= 0) state.items[index] = updated;
    state.itemsById.set(updated.id, updated);

    notify.success(`Autorização ${updated.transactionNumber} reaberta.`);
    renderDeadlineCards();
    render();

    // O Reabrir virou Finalizar na mesma linha; se ela saiu do filtro, foco nos resultados
    if (!table.focusRowAction(updated.id, '.js-finish')) table.focusResults();
  } catch (error) {
    opener.disabled = false;
    opener.classList.remove('is-loading');
    handleError(error);
  }
}

// ── Dados ────────────────────────────────────────────────────

async function load() {
  countEl.textContent = 'Carregando autorizações…';
  table.renderLoading();

  // allSettled: se só os tipos/status falharem, a lista ainda aparece
  const [requests, types, statuses] = await Promise.allSettled([
    api.get('api/authorization-requests'),
    api.get('api/authorization-types'),
    api.get('api/authorization-status'),
  ]);

  if (requests.status === 'rejected') {
    renderLoadError(requests.reason);
    return;
  }

  state.items = requests.value;
  state.itemsById = new Map(state.items.map((item) => [item.id, item]));
  state.loaded = true;
  renderDeadlineCards();

  // Opções = cadastro oficial + nomes presentes na lista (inclui tipos/status já desativados).
  // Falha nos auxiliares não é notificada: os nomes da própria lista bastam para filtrar.
  const namesFrom = (result) => (result.status === 'fulfilled' ? result.value.map((entry) => entry.name) : []);
  populateSelect(form.elements.namedItem('status'),
    [...namesFrom(statuses), ...state.items.map((item) => item.authorizationStatusName)], state.filters.status);
  populateSelect(form.elements.namedItem('tipo'),
    [...namesFrom(types), ...state.items.map((item) => item.authorizationTypeName)], state.filters.tipo);
  populateSelect(form.elements.namedItem('cadastradoPor'),
    state.items.map((item) => item.insertedByName), state.filters.cadastradoPor);

  render();
}

load();
