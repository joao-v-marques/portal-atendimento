import { ApiRequestError, api } from '../core/api.js';
import { getCurrentUser } from '../core/auth.js';
import { debounce, el } from '../core/dom.js';
import { handleError } from '../core/errors.js';
import { roleLabel } from '../core/format.js';
import { notify } from '../core/notify.js';
import { emptyState } from './authorization-table.js';
import { initPagination, paginate } from './pagination.js';
import { initRoleDialog } from './role-dialog.js';
import { DEFAULT_SORT, SORTABLE_KEYS, initRolesTable, sortRoles, usersCountText } from './roles-table.js';
import { nextSort } from './users-table.js';

const SITUATIONS = ['ativos', 'inativos', 'todos'];
const DEFAULT_SITUATION = 'todos';

const numberFormatter = new Intl.NumberFormat('pt-BR');

/** Busca sem acento e sem caixa: "funcao" encontra "Função" */
function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function hasActiveFilters({ busca, situacao }) {
  return Boolean(busca) || situacao !== DEFAULT_SITUATION;
}

function applyFilters(roles, { busca, situacao }) {
  const term = normalize(busca).trim();

  return roles.filter((role) => {
    if (situacao === 'ativos' && !role.isActive) return false;
    if (situacao === 'inativos' && role.isActive) return false;
    if (!term) return true;
    return normalize(`${roleLabel(role)} ${role.name}`).includes(term);
  });
}

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

/**
 * Aba Funções das configurações: listagem filtrável + criar, editar, desativar e reativar.
 * Mesmo fluxo da aba Usuários (settings.js), isolado num módulo porque só roda quando
 * a seção ativa é "funcoes" — a troca de seção recarrega a página (settings-nav.js).
 *
 * @param {HTMLElement} panel a <section data-section="funcoes">
 * @param {{ confirmDialog: { ask: Function } }} deps
 */
export function initRolesPanel(panel, { confirmDialog }) {
  const results = panel.querySelector('.js-roles-results');
  const countEl = panel.querySelector('.js-roles-count');
  const filtersForm = panel.querySelector('.js-roles-filters');
  const clearFiltersButton = filtersForm.querySelector('.js-roles-clear-filters');
  const searchField = filtersForm.elements.namedItem('busca');

  const state = {
    ...readStateFromUrl(),
    roles: [],
    rolesById: new Map(),
    loaded: false,
  };

  // replaceState: F5 e link compartilhado mantêm a busca sem encher o histórico
  function writeStateToUrl() {
    const params = new URLSearchParams();
    params.set('secao', 'funcoes');
    if (state.filters.busca) params.set('busca', state.filters.busca);
    if (state.filters.situacao !== DEFAULT_SITUATION) params.set('situacao', state.filters.situacao);
    if (state.sort.key !== DEFAULT_SORT.key || state.sort.direction !== DEFAULT_SORT.direction) {
      params.set('ordem', `${state.sort.key}:${state.sort.direction}`);
    }
    if (state.page > 1) params.set('pagina', String(state.page));
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
  }

  // ── Filtros ────────────────────────────────────────────────

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

  function clearFiltersAction() {
    filtersForm.reset();
    fillFilters({ busca: '', situacao: DEFAULT_SITUATION });
    applyFilterChange();
    searchField.focus();
  }

  // ── Componentes ────────────────────────────────────────────

  const table = initRolesTable(results, {
    onSort(key) {
      state.sort = nextSort(state.sort, key);
      table.setSort(state.sort);
      render();
    },
    onEdit(id, opener) {
      const role = state.rolesById.get(id);
      if (role) roleDialog.open({ role, opener });
    },
    onToggleActive(id, opener) {
      const role = state.rolesById.get(id);
      if (role) toggleActive(role, opener);
    },
  });

  const pagination = initPagination(panel.querySelector('.js-roles-pagination'), {
    onChange(page) {
      state.page = page;
      render();
      table.focusResults();
    },
  });

  function storeRole(role) {
    state.rolesById.set(role.id, role);
    const index = state.roles.findIndex((item) => item.id === role.id);
    if (index >= 0) state.roles[index] = role;
    else state.roles.push(role);
  }

  /** Troca a linha no lugar quando ela continua visível; senão refaz a tabela */
  function refreshRow(role, focusSelector) {
    const stillVisible = applyFilters([role], state.filters).length > 0;
    if (stillVisible && table.replaceRow(role)) {
      updateCount(applyFilters(state.roles, state.filters).length);
      table.focusRowAction(role.id, focusSelector);
      return;
    }
    // A linha saiu do filtro: o foco vai para a área de resultados, senão cairia no <body>
    render();
    table.focusResults();
  }

  const roleDialog = initRoleDialog(document.querySelector('.js-role-dialog'), {
    onSaved(saved, mode) {
      storeRole(saved);
      if (mode === 'edit') {
        refreshRow(saved, '.js-edit-role');
        return;
      }
      render();
    },
  });

  // ── Ativar / desativar ─────────────────────────────────────

  async function toggleActive(role, opener) {
    const label = roleLabel(role);

    if (role.isActive) {
      const count = role.activeUsers ?? 0;
      // Desativar não tira o acesso de ninguém: só deixa de oferecer a função ao cadastrar/editar usuários
      const impact = count > 0
        ? ` Os ${usersCountText(count)} que já têm essa função continuam com o mesmo acesso.`
        : '';

      const confirmed = await confirmDialog.ask({
        title: 'Desativar função?',
        description: `${label} deixa de aparecer na escolha de perfil dos usuários.${impact} Você pode reativar depois.`,
        confirmLabel: 'Desativar função',
        opener,
      });
      if (!confirmed) return;
    }

    const action = role.isActive ? 'deactivate' : 'reactivate';
    try {
      // A resposta não traz o id; o isActive é mesclado no item local
      const updated = await api.patch(`api/user-roles/${role.id}/${action}`);
      const merged = { ...role, isActive: updated.isActive };
      storeRole(merged);

      notify.success(`Função ${label} ${merged.isActive ? 'reativada' : 'desativada'}.`);
      refreshRow(merged, '.js-toggle-role');
    } catch (error) {
      handleError(error);
    }
  }

  // ── Renderização ───────────────────────────────────────────

  function updateCount(total) {
    countEl.textContent = total === 1 ? '1 função' : `${numberFormatter.format(total)} funções`;
  }

  function clearFiltersButtonNode() {
    const button = el('button', { className: 'c-button c-button--secondary', text: 'Limpar filtros', attrs: { type: 'button' } });
    button.addEventListener('click', clearFiltersAction);
    return button;
  }

  function render() {
    if (!state.loaded) return;

    const filtered = applyFilters(state.roles, state.filters);
    updateCount(filtered.length);

    if (state.roles.length === 0) {
      pagination.render(null);
      table.renderState(emptyState({
        icon: 'shield',
        title: 'Nenhuma função cadastrada',
        text: 'Crie a primeira função para atribuir aos usuários.',
      }));
      writeStateToUrl();
      return;
    }

    if (filtered.length === 0) {
      pagination.render(null);
      table.renderState(emptyState({
        icon: 'shield',
        title: 'Nenhum resultado para os filtros aplicados',
        text: 'Revise a busca ou limpe os filtros para ver todas as funções.',
        actions: [clearFiltersButtonNode()],
      }));
      writeStateToUrl();
      return;
    }

    const pageInfo = paginate(sortRoles(filtered, state.sort), state.page);
    state.page = pageInfo.page;
    table.renderRows(pageInfo.pageItems);
    pagination.render(pageInfo);
    writeStateToUrl();
  }

  function renderLoadError(error) {
    countEl.textContent = '';
    pagination.render(null);

    if (error instanceof ApiRequestError && error.status === 403) {
      table.renderState(emptyState({
        icon: 'alert',
        title: 'Sem permissão',
        text: 'Você não tem permissão para ver as funções. Fale com um administrador.',
      }));
      return;
    }

    const retry = el('button', { className: 'c-button c-button--secondary', text: 'Tentar novamente', attrs: { type: 'button' } });
    retry.addEventListener('click', load);

    table.renderState(emptyState({
      icon: 'alert',
      title: 'Não foi possível carregar as funções',
      text: 'Verifique sua conexão e tente novamente.',
      actions: [retry],
    }));
  }

  // ── Carregamento ───────────────────────────────────────────

  let loadController = null;

  async function load() {
    loadController?.abort();
    loadController = new AbortController();
    const { signal } = loadController;

    table.renderLoading();
    countEl.textContent = '';

    const [rolesResult, meResult] = await Promise.allSettled([
      api.get('api/user-roles', { signal }),
      getCurrentUser(),
    ]);

    if (signal.aborted) return;

    if (rolesResult.status === 'rejected') {
      const error = rolesResult.reason;
      if (error?.name === 'AbortError') return;
      renderLoadError(error);
      handleError(error);
      return;
    }

    state.roles = rolesResult.value;
    state.rolesById = new Map(state.roles.map((role) => [role.id, role]));
    if (meResult.status === 'fulfilled') table.setCurrentRoleName(meResult.value.role);

    state.loaded = true;
    render();
  }

  // ── Inicialização ──────────────────────────────────────────

  fillFilters(state.filters);
  clearFiltersButton.hidden = !hasActiveFilters(state.filters);
  table.setSort(state.sort);

  filtersForm.addEventListener('input', (event) => {
    if (event.target === searchField) applyFilterChangeDebounced();
  });

  filtersForm.addEventListener('change', (event) => {
    if (event.target !== searchField) applyFilterChange();
  });

  filtersForm.addEventListener('submit', (event) => {
    event.preventDefault();
    applyFilterChange();
  });

  clearFiltersButton.addEventListener('click', clearFiltersAction);

  panel.querySelector('.js-new-role').addEventListener('click', (event) => {
    roleDialog.open({ opener: event.currentTarget });
  });

  load();

  return {
    /** Campo que o atalho "/" da página deve focar quando esta aba está ativa */
    searchField,
  };
}
