import { el } from '../core/dom.js';
import { businessDaysLabel } from './authorization-table.js';

const SKELETON_ROWS = 8;

// Escala da régua do prazo: 21 dias úteis é o maior prazo comum da RN 566 da ANS
const DEADLINE_SCALE = 21;

export const SORTABLE_KEYS = ['code', 'name', 'maxDays'];
export const DEFAULT_SORT = { key: 'code', direction: 'asc' };

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/**
 * Ordena sem alterar a lista original. Empate no prazo: pelo código.
 * @param {object[]} items
 * @param {{ key: string, direction: 'asc' | 'desc' }} sort
 */
export function sortItems(items, { key, direction }) {
  const factor = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    if (key === 'maxDays') {
      const diff = (a.maxDays ?? 0) - (b.maxDays ?? 0);
      return factor * (diff || collator.compare(a.code, b.code));
    }
    return factor * collator.compare(String(a[key] ?? ''), String(b[key] ?? ''));
  });
}

/** @param {{ key: string, direction: 'asc' | 'desc' }} current */
export function nextSort(current, key) {
  if (current.key !== key) return { key, direction: 'asc' };
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}

// ── Células ──────────────────────────────────────────────────

/** "Imediato" em tom de alerta, ou "10 dias úteis" com a régua. Exportado para o diálogo reaproveitar o texto */
export function deadlineNode(maxDays) {
  if (maxDays === 0) {
    return el('span', { className: 'c-ans-deadline c-ans-deadline--now', text: 'Imediato' });
  }

  const track = el('span', { className: 'c-ans-deadline__track', attrs: { 'aria-hidden': 'true' } });
  track.style.setProperty('--fill', String(Math.min(maxDays, DEADLINE_SCALE) / DEADLINE_SCALE));

  const [, unit] = businessDaysLabel(maxDays).split(/^\d+ /);
  return el('span', { className: 'c-ans-deadline' }, [
    el('span', { className: 'c-ans-deadline__value', text: String(maxDays) }),
    el('span', { className: 'c-ans-deadline__unit', text: unit }),
    track,
  ]);
}

function situationCell(item) {
  return el('td', {}, [el('span', {
    className: `c-badge ${item.isActive ? 'c-badge--status-done' : 'c-badge--status-neutral'}`,
    text: item.isActive ? 'Ativo' : 'Inativo',
  })]);
}

function actionsCell(item) {
  const id = String(item.id);
  const label = `${item.code} ${item.name}`;
  const actions = [];

  // Inativo só pode ser reativado: o backend recusa editar um procedimento inativo
  if (item.isActive) {
    actions.push(el('button', {
      className: 'c-button c-button--ghost c-button--sm js-edit-item',
      attrs: { type: 'button', 'data-item-id': id, 'aria-label': `Editar procedimento ${label}` },
    }, [
      el('span', { className: 'c-icon c-icon--sm c-icon--pencil', attrs: { 'aria-hidden': 'true' } }),
      'Editar',
    ]));
  }

  actions.push(el('button', {
    className: `c-button c-button--sm js-toggle-active ${item.isActive ? 'c-button--danger' : 'c-button--secondary'}`,
    attrs: {
      type: 'button',
      'data-item-id': id,
      'aria-label': `${item.isActive ? 'Desativar' : 'Reativar'} procedimento ${label}`,
    },
  }, [
    el('span', {
      className: `c-icon c-icon--sm c-icon--${item.isActive ? 'user-x' : 'rotate-ccw'}`,
      attrs: { 'aria-hidden': 'true' },
    }),
    item.isActive ? 'Desativar' : 'Reativar',
  ]));

  return el('td', {}, [el('div', { className: 'c-row-actions' }, actions)]);
}

function renderRow(item) {
  return el('tr', {
    className: item.isActive ? '' : 'is-inactive',
    attrs: { 'data-item-row': String(item.id) },
  }, [
    el('td', {}, [el('span', { className: 'c-code', text: item.code || '—' })]),
    el('td', {}, [el('div', { className: 'c-procedures-table__name', text: item.name || '—' })]),
    el('td', {}, [deadlineNode(item.maxDays)]),
    situationCell(item),
    actionsCell(item),
  ]);
}

function renderSkeletonRow(columnCount) {
  const cells = Array.from({ length: columnCount }, () =>
    el('td', {}, [el('span', { className: 'c-skeleton c-skeleton--name', attrs: { 'aria-hidden': 'true' } })]));
  return el('tr', { className: 'c-table__skeleton-row' }, cells);
}

// ── Componente ───────────────────────────────────────────────

/**
 * Tabela de procedimentos (mesmo comportamento da tabela dos cadastros de atendimento).
 * @param {HTMLElement} root seção que contém a tabela e a área de estado
 * @param {{
 *   onSort: (key: string) => void,
 *   onEdit: (id: number, opener: HTMLElement) => void,
 *   onToggleActive: (id: number, opener: HTMLElement) => void,
 * }} callbacks
 */
export function initProcedureTable(root, { onSort, onEdit, onToggleActive }) {
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
      items.forEach((item) => fragment.append(renderRow(item)));
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
    replaceRow(item) {
      const existing = tbody.querySelector(`[data-item-row="${item.id}"]`);
      if (!existing) return false;
      existing.replaceWith(renderRow(item));
      return true;
    },

    /** @returns {boolean} false quando a linha não está na página atual */
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
