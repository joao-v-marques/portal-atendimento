import { el } from '../core/dom.js';
import { roleLabel } from '../core/format.js';

export const SORTABLE_KEYS = ['label', 'name', 'activeUsers'];
export const DEFAULT_SORT = { key: 'label', direction: 'asc' };

// Mesmo código do UserRoleService.ADMIN_ROLE: o backend recusa desativar
export const PROTECTED_ROLE = 'ADMIN';

const SKELETON_ROWS = 3;
const COLUMN_COUNT = 4;

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
const numberFormatter = new Intl.NumberFormat('pt-BR');

function sortValue(role, key) {
  if (key === 'label') return roleLabel(role);
  return role[key] ?? '';
}

/**
 * @param {object[]} roles
 * @param {{ key: string, direction: 'asc' | 'desc' }} sort
 */
export function sortRoles(roles, { key, direction }) {
  const factor = direction === 'asc' ? 1 : -1;
  if (key === 'activeUsers') {
    // Número comparado como número: o collator ordenaria "10" antes de "9" sem o numeric
    return [...roles].sort((a, b) => factor * ((a.activeUsers ?? 0) - (b.activeUsers ?? 0)));
  }
  return [...roles].sort((a, b) => factor * collator.compare(String(sortValue(a, key)), String(sortValue(b, key))));
}

export function usersCountText(count) {
  return count === 1 ? '1 usuário' : `${numberFormatter.format(count ?? 0)} usuários`;
}

// ── Células ──────────────────────────────────────────────────

function labelCell(role, isCurrentRole) {
  const children = [el('span', { className: 'c-role-cell__label', text: roleLabel(role) })];

  // Explica por que a pessoa não deve mexer sem cuidado: é a função com que ela mesma entrou
  if (isCurrentRole) {
    children.push(el('span', { className: 'c-badge c-badge--status-neutral', text: 'Sua função' }));
  }

  // Inativa também em texto, não só na cor da linha
  if (!role.isActive) {
    children.push(el('span', { className: 'c-badge c-badge--status-neutral', text: 'Inativa' }));
  }

  // Ícone fixo à esquerda; nome e selos num bloco que quebra linha quando falta espaço
  return el('div', { className: 'c-role-cell' }, [
    el('span', { className: 'c-role-cell__icon', attrs: { 'aria-hidden': 'true' } }, [
      el('span', { className: 'c-icon c-icon--sm c-icon--shield' }),
    ]),
    el('div', { className: 'c-role-cell__text' }, children),
  ]);
}

function usersCell(role) {
  const count = role.activeUsers ?? 0;
  if (count === 0) {
    return el('td', {}, [el('span', { className: 'c-table__secondary', text: 'Nenhum usuário' })]);
  }

  // Atalho para a aba Usuários já filtrada: a busca de lá também casa pelo nome da função.
  // Só ativos, senão a lista mostraria mais gente do que a contagem desta coluna
  const params = new URLSearchParams({ secao: 'usuarios', busca: roleLabel(role), situacao: 'ativos' });
  return el('td', {}, [
    el('a', {
      className: 'c-role-users-link',
      text: usersCountText(count),
      attrs: { href: `configuracoes?${params}`, title: `Ver os usuários ativos com a função ${roleLabel(role)}` },
    }),
  ]);
}

function actionsCell(role) {
  const id = String(role.id);
  const label = roleLabel(role);
  const actions = [];

  // Função inativa só pode ser reativada: o backend recusa editar inativa
  if (role.isActive) {
    actions.push(el('button', {
      className: 'c-button c-button--ghost c-button--sm js-edit-role',
      attrs: { type: 'button', 'data-role-id': id, 'aria-label': `Editar função ${label}` },
    }, [
      el('span', { className: 'c-icon c-icon--sm c-icon--pencil', attrs: { 'aria-hidden': 'true' } }),
      'Editar',
    ]));
  }

  const toggle = el('button', {
    className: `c-button c-button--sm js-toggle-role ${role.isActive ? 'c-button--danger' : 'c-button--secondary'}`,
    attrs: {
      type: 'button',
      'data-role-id': id,
      'aria-label': `${role.isActive ? 'Desativar' : 'Reativar'} função ${label}`,
    },
  }, [
    el('span', {
      className: `c-icon c-icon--sm c-icon--${role.isActive ? 'user-x' : 'user-check'}`,
      attrs: { 'aria-hidden': 'true' },
    }),
    role.isActive ? 'Desativar' : 'Reativar',
  ]);

  if (role.name === PROTECTED_ROLE && role.isActive) {
    toggle.disabled = true;
    toggle.title = 'A função de administrador não pode ser desativada.';
  }

  actions.push(toggle);

  return el('td', {}, [el('div', { className: 'c-row-actions' }, actions)]);
}

function renderRow(role, currentRoleName) {
  return el('tr', {
    className: role.isActive ? '' : 'c-table__secondary',
    attrs: { 'data-role-row': String(role.id) },
  }, [
    el('td', {}, [labelCell(role, role.name === currentRoleName)]),
    el('td', {}, [el('code', { className: 'c-code', text: role.name, attrs: { title: role.name } })]),
    usersCell(role),
    actionsCell(role),
  ]);
}

function renderSkeletonRow() {
  const cells = Array.from({ length: COLUMN_COUNT }, () =>
    el('td', {}, [el('span', { className: 'c-skeleton c-skeleton--name', attrs: { 'aria-hidden': 'true' } })]));
  return el('tr', { className: 'c-table__skeleton-row' }, cells);
}

// ── Componente ───────────────────────────────────────────────

/**
 * Mesmo contrato do users-table.js, para a aba Funções.
 * @param {HTMLElement} root elemento que contém a tabela e a área de estado
 * @param {{
 *   onSort: (key: string) => void,
 *   onEdit: (id: number, opener: HTMLElement) => void,
 *   onToggleActive: (id: number, opener: HTMLElement) => void,
 * }} callbacks
 */
export function initRolesTable(root, { onSort, onEdit, onToggleActive }) {
  const wrapper = root.querySelector('.js-roles-table-wrapper');
  const tbody = root.querySelector('.js-roles-table-body');
  const stateArea = root.querySelector('.js-roles-table-state');
  const sortableHeaders = [...root.querySelectorAll('th[data-sort-key]')];
  let currentRoleName = null;

  root.querySelector('thead').addEventListener('click', (event) => {
    const button = event.target.closest('.js-sort');
    if (button) onSort(button.closest('th').dataset.sortKey);
  });

  tbody.addEventListener('click', (event) => {
    const editButton = event.target.closest('.js-edit-role');
    if (editButton) {
      onEdit(Number(editButton.dataset.roleId), editButton);
      return;
    }

    const toggleButton = event.target.closest('.js-toggle-role');
    if (toggleButton) onToggleActive(Number(toggleButton.dataset.roleId), toggleButton);
  });

  function showTable() {
    wrapper.hidden = false;
    stateArea.hidden = true;
    stateArea.replaceChildren();
  }

  return {
    /** Código da função do usuário logado, para o badge "Sua função" */
    setCurrentRoleName(name) {
      currentRoleName = name;
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

    renderRows(roles) {
      showTable();
      wrapper.removeAttribute('aria-busy');
      const fragment = document.createDocumentFragment();
      roles.forEach((role) => fragment.append(renderRow(role, currentRoleName)));
      tbody.replaceChildren(fragment);
    },

    renderState(node) {
      wrapper.hidden = true;
      wrapper.removeAttribute('aria-busy');
      tbody.replaceChildren();
      stateArea.replaceChildren(node);
      stateArea.hidden = false;
    },

    /** @returns {boolean} false quando a linha não está na página atual */
    replaceRow(role) {
      const existing = tbody.querySelector(`[data-role-row="${role.id}"]`);
      if (!existing) return false;
      existing.replaceWith(renderRow(role, currentRoleName));
      return true;
    },

    focusRowAction(id, selector) {
      tbody.querySelector(`${selector}[data-role-id="${id}"]`)?.focus();
    },

    focusResults() {
      const target = wrapper.hidden ? stateArea : wrapper;
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
      target.focus({ preventScroll: true });
    },
  };
}
