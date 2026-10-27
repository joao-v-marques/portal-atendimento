import { initAppShell } from '../components/app-shell.js';
import { emptyState } from '../components/authorization-table.js';
import { initConfirmDialog } from '../components/confirm-dialog.js';
import { initPagination, paginate } from '../components/pagination.js';
import { initRolesPanel } from '../components/roles-panel.js';
import { DEFAULT_SECTION, initSettingsNav } from '../components/settings-nav.js';
import { initUserDialog } from '../components/user-dialog.js';
import { initUserPasswordDialog } from '../components/user-password-dialog.js';
import { DEFAULT_SORT, SORTABLE_KEYS, initUsersTable, nextSort, sortUsers, userRoleLabel } from '../components/users-table.js';
import { ApiRequestError, api } from '../core/api.js';
import { getCurrentUser } from '../core/auth.js';
import { debounce, el } from '../core/dom.js';
import { handleError } from '../core/errors.js';
import { notify } from '../core/notify.js';

const SITUATIONS = ['ativos', 'inativos', 'todos'];
const DEFAULT_SITUATION = 'todos';

const numberFormatter = new Intl.NumberFormat('pt-BR');

const nav = document.querySelector('.js-settings-nav');
const panels = [...document.querySelectorAll('.js-panel')];
const results = document.querySelector('.js-results');
const countEl = document.querySelector('.js-results-count');
const filtersForm = document.querySelector('.js-filters');
const clearFiltersButton = filtersForm.querySelector('.js-clear-filters');
const searchField = filtersForm.elements.namedItem('busca');

// ── Estado (espelhado na query string) ───────────────────────

function readStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const situacao = params.get('situacao');
  const [key, direction] = (params.get('ordem') ?? '').split(':');
  const sort = SORTABLE_KEYS.includes(key) && (direction === 'asc' || direction === 'desc')
    ? { key, direction }
    : { ...DEFAULT_SORT };

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
  params.set('secao', state.section);
  if (filters.busca) params.set('busca', filters.busca);
  if (filters.situacao !== DEFAULT_SITUATION) params.set('situacao', filters.situacao);
  if (sort.key !== DEFAULT_SORT.key || sort.direction !== DEFAULT_SORT.direction) params.set('ordem', `${sort.key}:${sort.direction}`);
  if (page > 1) params.set('pagina', String(page));
  window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
}

const state = {
  section: DEFAULT_SECTION,
  ...readStateFromUrl(),
  users: [],
  usersById: new Map(),
  currentUserId: null,
  loaded: false,
};

// ── Seção ativa ──────────────────────────────────────────────

state.section = initSettingsNav(nav, panels).section;

// ── Filtros ──────────────────────────────────────────────────

/** Busca sem acento e sem caixa: "jose" encontra "José" */
function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function hasActiveFilters({ busca, situacao }) {
  return Boolean(busca) || situacao !== DEFAULT_SITUATION;
}

function applyFilters(users, { busca, situacao }) {
  const term = normalize(busca).trim();

  return users.filter((user) => {
    if (situacao === 'ativos' && !user.isActive) return false;
    if (situacao === 'inativos' && user.isActive) return false;
    if (!term) return true;

    const haystack = [user.username, user.name, user.email, userRoleLabel(user)]
      .map(normalize)
      .join(' ');

    return haystack.includes(term);
  });
}

function readFilters() {
  return {
    busca: String(filtersForm.elements.namedItem('busca').value).trim(),
    situacao: filtersForm.elements.namedItem('situacao').value,
  };
}

function fillFilters({ busca, situacao }) {
  filtersForm.elements.namedItem('busca').value = busca;
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

const table = initUsersTable(results, {
  onSort(key) {
    state.sort = nextSort(state.sort, key);
    table.setSort(state.sort);
    render();
  },
  onEdit(id, opener) {
    const user = state.usersById.get(id);
    if (user) userDialog.open({ user, opener });
  },
  onToggleActive(id, opener) {
    const user = state.usersById.get(id);
    if (user) toggleActive(user, opener);
  },
});

const pagination = initPagination(document.querySelector('.js-pagination'), {
  onChange(page) {
    state.page = page;
    render();
    table.focusResults();
  },
});

const confirmDialog = initConfirmDialog(document.querySelector('.js-confirm-dialog'));

const passwordDialog = initUserPasswordDialog(document.querySelector('.js-password-dialog'), {
  onDone() {
    // Senha não aparece na tabela: nada a re-renderizar
  },
});

const userDialog = initUserDialog(document.querySelector('.js-user-dialog'), {
  onSaved(saved, mode) {
    if (mode === 'create') {
      state.users.push(saved);
    } else {
      const index = state.users.findIndex((user) => user.id === saved.id);
      if (index >= 0) state.users[index] = saved;
    }
    state.usersById.set(saved.id, saved);

    // Linha trocada no lugar quando já está na página; senão a tabela inteira
    if (mode === 'edit' && table.replaceRow(saved)) {
      updateCount(applyFilters(state.users, state.filters).length);
      table.focusRowAction(saved.id, '.js-edit-user');
      return;
    }

    render();
  },
  onResetPassword(user) {
    // Reabre em sequência; o foco volta para a ação da linha, não para o diálogo fechado
    passwordDialog.open({ user, opener: results.querySelector(`.js-edit-user[data-user-id="${user.id}"]`) });
  },
});

// ── Ativar / desativar ───────────────────────────────────────

async function toggleActive(user, opener) {
  const label = user.name?.trim() || user.username;

  if (user.isActive) {
    const confirmed = await confirmDialog.ask({
      title: 'Desativar usuário?',
      description: `${label} não conseguirá mais acessar o portal, mesmo que esteja logado agora. Você pode reativar depois.`,
      confirmLabel: 'Desativar usuário',
      opener,
    });
    if (!confirmed) return;
  }

  const action = user.isActive ? 'deactivate' : 'reactivate';
  try {
    // A resposta não traz o id; o isActive é mesclado no item local pelo id da chamada
    const updated = await api.patch(`api/users/${user.id}/${action}`);
    const merged = { ...user, isActive: updated.isActive };

    state.usersById.set(user.id, merged);
    const index = state.users.findIndex((item) => item.id === user.id);
    if (index >= 0) state.users[index] = merged;

    notify.success(`Usuário ${label} ${merged.isActive ? 'reativado' : 'desativado'}.`);

    // Fora do filtro atual a linha sai da tabela; dentro dele, só a linha muda
    const stillVisible = applyFilters([merged], state.filters).length > 0;
    if (stillVisible && table.replaceRow(merged)) {
      updateCount(applyFilters(state.users, state.filters).length);
      // O rótulo mudou de Desativar para Reativar, então o nó anterior já não existe
      table.focusRowAction(user.id, '.js-toggle-active');
      return;
    }

    // A linha saiu do filtro: não há botão para devolver o foco, então ele vai para
    // a área de resultados — senão cairia no <body>
    render();
    table.focusResults();
  } catch (error) {
    handleError(error);
  }
}

// ── Renderização ─────────────────────────────────────────────

function updateCount(total) {
  countEl.textContent = total === 1 ? '1 usuário' : `${numberFormatter.format(total)} usuários`;
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

function render() {
  if (!state.loaded) return;

  const filtered = applyFilters(state.users, state.filters);
  updateCount(filtered.length);

  if (state.users.length === 0) {
    pagination.render(null);
    table.renderState(emptyState({
      icon: 'users',
      title: 'Nenhum usuário cadastrado',
      text: 'Crie o primeiro usuário para liberar o acesso ao portal.',
    }));
    writeStateToUrl(state);
    return;
  }

  if (filtered.length === 0) {
    pagination.render(null);
    table.renderState(emptyState({
      icon: 'users',
      title: 'Nenhum resultado para os filtros aplicados',
      text: 'Revise a busca ou limpe os filtros para ver todos os usuários.',
      actions: [clearFiltersButtonNode()],
    }));
    writeStateToUrl(state);
    return;
  }

  const pageInfo = paginate(sortUsers(filtered, state.sort), state.page);
  state.page = pageInfo.page;
  table.renderRows(pageInfo.pageItems);
  pagination.render(pageInfo);
  writeStateToUrl(state);
}

function renderLoadError(error) {
  countEl.textContent = '';
  pagination.render(null);

  // Sem permissão precisa de estado próprio: só o Notyf deixaria a área vazia
  if (error instanceof ApiRequestError && error.status === 403) {
    table.renderState(emptyState({
      icon: 'alert',
      title: 'Sem permissão',
      text: 'Você não tem permissão para ver os usuários. Fale com um administrador.',
    }));
    return;
  }

  const retry = el('button', { className: 'c-button c-button--secondary', text: 'Tentar novamente', attrs: { type: 'button' } });
  retry.addEventListener('click', loadUsers);

  table.renderState(emptyState({
    icon: 'alert',
    title: 'Não foi possível carregar os usuários',
    text: 'Verifique sua conexão e tente novamente.',
    actions: [retry],
  }));
}

// ── Carregamento ─────────────────────────────────────────────

let loadController = null;

async function loadUsers() {
  loadController?.abort(); // cancela um carregamento anterior ainda em voo
  loadController = new AbortController();
  const { signal } = loadController;

  table.renderLoading();
  countEl.textContent = '';

  // Em paralelo: a lista não depende dos perfis, e os perfis só alimentam o diálogo.
  // getCurrentUser() é memoizado pelo core/auth.js, então divide a chamada com o shell
  const [usersResult, rolesResult, meResult] = await Promise.allSettled([
    api.get('api/users', { signal }),
    api.get('api/user-roles', { signal }),
    getCurrentUser(),
  ]);

  if (signal.aborted) return;

  if (rolesResult.status === 'fulfilled') {
    userDialog.setRoles(rolesResult.value);
  } else {
    // A lista continua utilizável; só criar/editar fica sem perfis para escolher
    handleError(rolesResult.reason);
  }

  if (usersResult.status === 'rejected') {
    const error = usersResult.reason;
    if (error?.name === 'AbortError') return;
    renderLoadError(error);
    handleError(error);
    return;
  }

  state.users = usersResult.value;
  state.usersById = new Map(state.users.map((user) => [user.id, user]));

  // O /api/auth/me não devolve o id, então a própria linha é achada pelo username.
  // Resolvido aqui, e não na resposta do shell, para não depender de quem chega primeiro
  if (meResult.status === 'fulfilled') {
    state.currentUserId = state.users.find((user) => user.username === meResult.value.username)?.id ?? null;
    table.setCurrentUserId(state.currentUserId);
  }

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

document.querySelector('.js-new-user').addEventListener('click', (event) => {
  userDialog.open({ opener: event.currentTarget });
});

// Atalho "/" foca a busca (ignorado enquanto a pessoa digita em outro campo ou há modal aberto)
document.addEventListener('keydown', (event) => {
  if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  const isTyping = target instanceof Element && target.closest('input, select, textarea, [contenteditable="true"]');
  if (isTyping || document.querySelector('dialog[open]')) return;
  event.preventDefault();
  activeSearchField.focus();
});

// A troca de seção recarrega a página (settings-nav.js), então só a aba ativa carrega dados
let activeSearchField = searchField;
if (state.section === 'funcoes') {
  activeSearchField = initRolesPanel(document.querySelector('#painel-funcoes'), { confirmDialog }).searchField;
} else {
  loadUsers();
}
