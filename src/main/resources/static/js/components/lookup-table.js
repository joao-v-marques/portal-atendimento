import { el } from '../core/dom.js';
import { isSystemItem } from './lookup-config.js';

const SKELETON_ROWS = 5;

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/** Severidade ordena pelo nível (a gravidade), os demais pelo nome */
export function defaultSort(lookup) {
  return lookup.hasLevel ? { key: 'level', direction: 'asc' } : { key: 'name', direction: 'asc' };
}

export function sortableKeys(lookup) {
  return lookup.hasLevel ? ['name', 'level'] : ['name'];
}

/**
 * @param {object[]} items
 * @param {{ key: string, direction: 'asc' | 'desc' }} sort
 */
export function sortItems(items, { key, direction }) {
  const factor = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    if (key === 'level') return factor * ((a.level ?? 0) - (b.level ?? 0));
    return factor * collator.compare(String(a[key] ?? ''), String(b[key] ?? ''));
  });
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

function nameCell(lookup, item) {
  const children = [el('span', { className: 'c-table__truncate', text: item.name || '—', attrs: { title: item.name || '' } })];

  // Explica por que esta linha não tem o botão Desativar
  if (isSystemItem(lookup, item)) {
    children.push(el('span', {
      className: 'c-badge c-badge--status-neutral',
      text: 'Sistema',
      attrs: { title: 'Usado pelo fluxo do atendimento: pode ser renomeado, mas não desativado.' },
    }));
  }

  return el('div', { className: 'c-user-cell' }, children);
}

function situationCell(item) {
  return el('td', {}, [el('span', {
    className: `c-badge ${item.isActive ? 'c-badge--status-done' : 'c-badge--status-neutral'}`,
    text: item.isActive ? 'Ativo' : 'Inativo',
  })]);
}

function actionsCell(lookup, item) {
  const id = String(item.id);
  const actions = [];

  // Inativo só pode ser reativado: o backend recusa editar um cadastro inativo
  if (item.isActive) {
    actions.push(el('button', {
      className: 'c-button c-button--ghost c-button--sm js-edit-item',
      attrs: { type: 'button', 'data-item-id': id, 'aria-label': `Editar ${lookup.singular} ${item.name}` },
    }, [
      el('span', { className: 'c-icon c-icon--sm c-icon--pencil', attrs: { 'aria-hidden': 'true' } }),
      'Editar',
    ]));
  }

  if (!isSystemItem(lookup, item)) {
    actions.push(el('button', {
      className: `c-button c-button--sm js-toggle-active ${item.isActive ? 'c-button--danger' : 'c-button--secondary'}`,
      attrs: {
        type: 'button',
        'data-item-id': id,
        'aria-label': `${item.isActive ? 'Desativar' : 'Reativar'} ${lookup.singular} ${item.name}`,
      },
    }, [
      el('span', {
        className: `c-icon c-icon--sm c-icon--${item.isActive ? 'user-x' : 'check-circle'}`,
        attrs: { 'aria-hidden': 'true' },
      }),
      item.isActive ? 'Desativar' : 'Reativar',
    ]));
  }

  return el('td', {}, [el('div', { className: 'c-row-actions' }, actions)]);
}

function renderRow(lookup, item) {
  const cells = [el('td', {}, [nameCell(lookup, item)])];
  if (lookup.hasLevel) cells.push(el('td', { className: 'u-text-mono', text: item.level ?? '—' }));
  cells.push(situationCell(item), actionsCell(lookup, item));

  return el('tr', {
    className: item.isActive ? '' : 'c-table__secondary',
    attrs: { 'data-item-row': String(item.id) },
  }, cells);
}

function renderSkeletonRow(columnCount) {
  const cells = Array.from({ length: columnCount }, () =>
    el('td', {}, [el('span', { className: 'c-skeleton c-skeleton--name', attrs: { 'aria-hidden': 'true' } })]));
  return el('tr', { className: 'c-table__skeleton-row' }, cells);
}

// ── Componente ───────────────────────────────────────────────

/**
 * Tabela de um cadastro auxiliar (mesmo comportamento da tabela de usuários).
 * @param {HTMLElement} root painel que contém a tabela e a área de estado
 * @param {object} lookup item de LOOKUPS
 * @param {{
 *   onSort: (key: string) => void,
 *   onEdit: (id: number, opener: HTMLElement) => void,
 *   onToggleActive: (id: number, opener: HTMLElement) => void,
 * }} callbacks
 */
export function initLookupTable(root, lookup, { onSort, onEdit, onToggleActive }) {
  const wrapper = root.querySelector('.js-table-wrapper');
  const tbody = root.querySelector('.js-table-body');
  const stateArea = root.querySelector('.js-table-state');
  const sortableHeaders = [...root.querySelectorAll('th[data-sort-key]')];
  const columnCount = root.querySelectorAll('thead th').length;

  root.querySelector('thead').addEventListener('click', (event) => {
    const button = event.target.closest('.js-sort');
    if (button) onSort(button.closest('th').dataset.sortKey);
  });

  tbody.addEventListener('click', (event) => {
    const editButton = event.target.closest('.js-edit-item');
    if (editButton) {
      onEdit(Number(editButton.dataset.itemId), editButton);
      return;
    }

    const toggleButton = event.target.closest('.js-toggle-active');
    if (toggleButton) onToggleActive(Number(toggleButton.dataset.itemId), toggleButton);
  });

  function showTable() {
    wrapper.hidden = false;
    stateArea.hidden = true;
    stateArea.replaceChildren();
  }

  return {
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
      for (let i = 0; i < SKELETON_ROWS; i++) fragment.append(renderSkeletonRow(columnCount));
      tbody.replaceChildren(fragment);
    },

    renderRows(items) {
      showTable();
      wrapper.removeAttribute('aria-busy');
      const fragment = document.createDocumentFragment();
      items.forEach((item) => fragment.append(renderRow(lookup, item)));
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
     * Troca uma linha no lugar, sem refazer a tabela.
     * @returns {boolean} false quando a linha não está na página atual
     */
    replaceRow(item) {
      const existing = tbody.querySelector(`[data-item-row="${item.id}"]`);
      if (!existing) return false;
      existing.replaceWith(renderRow(lookup, item));
      return true;
    },

    /**
     * Devolve o foco à ação da linha depois do re-render, que destruiu o botão anterior.
     * @returns {boolean} false quando a linha não está na página atual
     */
    focusRowAction(id, selector) {
      const target = tbody.querySelector(`${selector}[data-item-id="${id}"]`)
        ?? tbody.querySelector(`[data-item-row="${id}"] button`);
      target?.focus();
      return Boolean(target);
    },

    focusResults() {
      const target = wrapper.hidden ? stateArea : wrapper;
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
      target.focus({ preventScroll: true });
    },
  };
}
