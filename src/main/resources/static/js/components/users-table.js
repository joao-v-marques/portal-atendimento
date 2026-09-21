import { el } from '../core/dom.js';
import { getInitials, roleLabel } from '../core/format.js';

export const SORTABLE_KEYS = ['username', 'name', 'roleName', 'createdAt'];
export const DEFAULT_SORT = { key: 'username', direction: 'asc' };

const SKELETON_ROWS = 5;
const COLUMN_COUNT = 6;

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

// Só a data: a hora do cadastro de um usuário não ajuda a decidir nada e a coluna
// empurrava as ações fora da tabela. Não é o formatDate() do core/format.js, que
// espera "AAAA-MM-DD" (LocalDate); aqui o createdAt vem com fuso, e o Date resolve
const dateFormatter = new Intl.DateTimeFormat('pt-BR');

function formatCreatedAt(iso) {
  return iso ? dateFormatter.format(new Date(iso)) : '—';
}

/**
 * O perfil vem aninhado: UserResponse.roleId serializa a entidade UserRole inteira
 * ({ id, name, active }), não um id. O nome do campo é herdado do DTO de escrita.
 * @param {{ roleId?: { id?: number, name?: string } }} user
 */
export function userRoleId(user) {
  return user?.roleId?.id ?? null;
}

export function userRoleName(user) {
  return user?.roleId?.name ?? '';
}

function sortValue(user, key) {
  if (key === 'roleName') return roleLabel(userRoleName(user));
  if (key === 'createdAt') return user.createdAt ?? '';
  return user[key] ?? '';
}

/**
 * @param {object[]} users
 * @param {{ key: string, direction: 'asc' | 'desc' }} sort
 */
export function sortUsers(users, { key, direction }) {
  const factor = direction === 'asc' ? 1 : -1;
  return [...users].sort((a, b) => factor * collator.compare(String(sortValue(a, key)), String(sortValue(b, key))));
}

/**
 * Próximo estado de ordenação ao clicar numa coluna.
 * @param {{ key: string, direction: 'asc' | 'desc' }} current
 * @param {string} key
 */
export function nextSort(current, key) {
  if (current.key !== key) return { key, direction: 'asc' };
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}

// ── Células ──────────────────────────────────────────────────

function truncated(text) {
  const value = text || '—';
  return el('span', { className: 'c-table__truncate', text: value, attrs: { title: value } });
}

function nameCell(user, isCurrentUser) {
  const name = user.name?.trim() || user.username;
  const children = [
    el('span', { className: 'c-avatar', text: getInitials(name), attrs: { 'aria-hidden': 'true' } }),
    truncated(user.name),
  ];

  // Badge "Você": explica por que desativar e trocar de perfil estão bloqueados nesta linha
  if (isCurrentUser) {
    children.push(el('span', { className: 'c-badge c-badge--status-neutral', text: 'Você' }));
  }

  // Inativo também em texto, não só na cor da linha
  if (!user.isActive) {
    children.push(el('span', { className: 'c-badge c-badge--status-neutral', text: 'Inativo' }));
  }

  return el('div', { className: 'c-user-cell' }, children);
}

function actionsCell(user, isCurrentUser) {
  const id = String(user.id);
  const label = user.name?.trim() || user.username;
  const actions = [];

  // Usuário inativo só pode ser reativado: o backend recusa editar e redefinir senha de inativo
  if (user.isActive) {
    actions.push(el('button', {
      className: 'c-button c-button--ghost c-button--sm js-edit-user',
      attrs: { type: 'button', 'data-user-id': id, 'aria-label': `Editar usuário ${label}` },
    }, [
      el('span', { className: 'c-icon c-icon--sm c-icon--pencil', attrs: { 'aria-hidden': 'true' } }),
      'Editar',
    ]));
  }

  const toggle = el('button', {
    className: `c-button c-button--sm js-toggle-active ${user.isActive ? 'c-button--danger' : 'c-button--secondary'}`,
    attrs: {
      type: 'button',
      'data-user-id': id,
      'aria-label': `${user.isActive ? 'Desativar' : 'Reativar'} usuário ${label}`,
    },
  }, [
    el('span', {
      className: `c-icon c-icon--sm c-icon--${user.isActive ? 'user-x' : 'user-check'}`,
      attrs: { 'aria-hidden': 'true' },
    }),
    user.isActive ? 'Desativar' : 'Reativar',
  ]);

  if (isCurrentUser) {
    toggle.disabled = true;
    toggle.title = 'Você não pode desativar o próprio usuário.';
  }

  actions.push(toggle);

  return el('td', {}, [el('div', { className: 'c-row-actions' }, actions)]);
}

function renderRow(user, currentUserId) {
  const isCurrentUser = currentUserId !== null && user.id === currentUserId;

  return el('tr', {
    className: user.isActive ? '' : 'c-table__secondary',
    attrs: { 'data-user-row': String(user.id) },
  }, [
    el('td', {}, [el('span', { className: 'u-text-mono', text: user.username })]),
    el('td', {}, [nameCell(user, isCurrentUser)]),
    el('td', {}, [truncated(user.email)]),
    el('td', { text: roleLabel(userRoleName(user)) || '—' }),
    el('td', { text: formatCreatedAt(user.createdAt) }),
    actionsCell(user, isCurrentUser),
  ]);
}

function renderSkeletonRow() {
  const cells = Array.from({ length: COLUMN_COUNT }, () =>
    el('td', {}, [el('span', { className: 'c-skeleton c-skeleton--name', attrs: { 'aria-hidden': 'true' } })]));
  return el('tr', { className: 'c-table__skeleton-row' }, cells);
}

// ── Componente ───────────────────────────────────────────────

/**
 * @param {HTMLElement} root elemento que contém a tabela e a área de estado
 * @param {{
 *   onSort: (key: string) => void,
 *   onEdit: (id: number, opener: HTMLElement) => void,
 *   onToggleActive: (id: number, opener: HTMLElement) => void,
 * }} callbacks
 */
export function initUsersTable(root, { onSort, onEdit, onToggleActive }) {
  const wrapper = root.querySelector('.js-table-wrapper');
  const tbody = root.querySelector('.js-table-body');
  const stateArea = root.querySelector('.js-table-state');
  const sortableHeaders = [...root.querySelectorAll('th[data-sort-key]')];
  let currentUserId = null;

  // Delegação: um listener para toda a tabela, em vez de um por botão de linha
  root.querySelector('thead').addEventListener('click', (event) => {
    const button = event.target.closest('.js-sort');
    if (button) onSort(button.closest('th').dataset.sortKey);
  });

  tbody.addEventListener('click', (event) => {
    const editButton = event.target.closest('.js-edit-user');
    if (editButton) {
      onEdit(Number(editButton.dataset.userId), editButton);
      return;
    }

    const toggleButton = event.target.closest('.js-toggle-active');
    if (toggleButton) onToggleActive(Number(toggleButton.dataset.userId), toggleButton);
  });

  function showTable() {
    wrapper.hidden = false;
    stateArea.hidden = true;
    stateArea.replaceChildren();
  }

  return {
    /** O id do usuário logado marca a própria linha e bloqueia as ações nela */
    setCurrentUserId(id) {
      currentUserId = id;
    },

    setSort(sort) {
      for (const th of sortableHeaders) {
        const isActive = th.dataset.sortKey === sort.key;
        th.setAttribute('aria-sort', isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none');
      }
    },

    renderLoading() {
      showTable();
      wrapper.setAttribute('aria-busy', 'true');
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < SKELETON_ROWS; i++) fragment.append(renderSkeletonRow());
      tbody.replaceChildren(fragment);
    },

    renderRows(users) {
      showTable();
      wrapper.removeAttribute('aria-busy');
      const fragment = document.createDocumentFragment();
      users.forEach((user) => fragment.append(renderRow(user, currentUserId)));
      tbody.replaceChildren(fragment);
    },

    renderState(node) {
      wrapper.hidden = true;
      wrapper.removeAttribute('aria-busy');
      tbody.replaceChildren();
      stateArea.replaceChildren(node);
      stateArea.hidden = false;
    },

    /**
     * Troca uma linha no lugar, sem refazer a tabela (guia 12.6).
     * @returns {boolean} false quando a linha não está na página atual
     */
    replaceRow(user) {
      const existing = tbody.querySelector(`[data-user-row="${user.id}"]`);
      if (!existing) return false;
      existing.replaceWith(renderRow(user, currentUserId));
      return true;
    },

    /** Devolve o foco à ação da linha depois do re-render, que destruiu o botão anterior */
    focusRowAction(id, selector) {
      tbody.querySelector(`${selector}[data-user-id="${id}"]`)?.focus();
    },

    focusResults() {
      const target = wrapper.hidden ? stateArea : wrapper;
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
      target.focus({ preventScroll: true });
    },
  };
}
