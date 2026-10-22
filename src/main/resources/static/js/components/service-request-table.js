import { el } from '../core/dom.js';
import { formatDateTime } from '../core/format.js';
import { statusBadge } from './authorization-table.js';

export const SORTABLE_KEYS = ['openedAt', 'protocolNumber', 'requesterName', 'statusName', 'assignedToName'];
export const DEFAULT_SORT = { key: 'openedAt', direction: 'desc' };

// Status de sistema "Finalizado", mesmo id do STATUS_FINISHED_ID do ServiceRequestService (seed da V7)
export const FINISHED_STATUS_ID = 2;

const DATE_KEYS = new Set(['openedAt', 'createdAt']);
const COLUMN_COUNT = 8;
const SKELETON_ROWS = 5;

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

// ── Dados ────────────────────────────────────────────────────

/**
 * @param {{ statusId?: number }} item
 */
export function isFinished(item) {
  return item.statusId === FINISHED_STATUS_ID;
}

function compareValues(key, a, b) {
  // OffsetDateTime pode vir com offsets diferentes: compara o instante, não o texto
  if (DATE_KEYS.has(key)) return (Date.parse(a[key]) || 0) - (Date.parse(b[key]) || 0);
  return collator.compare(String(a[key] ?? ''), String(b[key] ?? ''));
}

/**
 * Ordena sem alterar a lista original. Empate: aberto mais recentemente primeiro.
 * @param {object[]} items
 * @param {{ key: string, direction: 'asc' | 'desc' }} sort
 */
export function sortItems(items, { key, direction }) {
  const factor = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) =>
    Math.sign(compareValues(key, a, b)) * factor || compareValues('openedAt', b, a));
}

/**
 * Próxima ordenação ao clicar numa coluna: inverte a atual ou começa pelo mais útil
 * (datas: mais recentes; textos: A→Z).
 */
export function nextSort(current, key) {
  if (current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: DATE_KEYS.has(key) ? 'desc' : 'asc' };
}

// ── Linhas ───────────────────────────────────────────────────

function truncated(text) {
  const value = text || '—';
  return el('span', { className: 'c-table__truncate', text: value, attrs: { title: value } });
}

function actionButton({ action, icon, label, ariaLabel, variant, id }) {
  return el('button', {
    className: `c-button c-button--${variant} c-button--sm js-${action}`,
    attrs: { type: 'button', 'data-request-id': String(id), 'aria-label': ariaLabel },
  }, [
    ...(icon ? [el('span', { className: `c-icon c-icon--sm c-icon--${icon}`, attrs: { 'aria-hidden': 'true' } })] : []),
    label,
  ]);
}

/**
 * Ações permitidas pelo backend para o status atual: finalizado só reabre; em andamento edita e finaliza.
 * @param {object} item
 */
function rowActions(item) {
  const { id, protocolNumber } = item;
  const actions = [actionButton({
    action: 'view', icon: 'eye', label: 'Detalhar', variant: 'ghost', id,
    ariaLabel: `Detalhar o atendimento ${protocolNumber}`,
  })];

  if (isFinished(item)) {
    actions.push(actionButton({
      action: 'reopen', label: 'Reabrir', variant: 'secondary', id,
      ariaLabel: `Reabrir o atendimento ${protocolNumber}`,
    }));
  } else {
    actions.push(
      actionButton({
        action: 'edit', icon: 'pencil', label: 'Editar', variant: 'secondary', id,
        ariaLabel: `Editar o atendimento ${protocolNumber}`,
      }),
      actionButton({
        action: 'finish', icon: 'check-circle', label: 'Finalizar', variant: 'secondary', id,
        ariaLabel: `Finalizar o atendimento ${protocolNumber}`,
      }),
    );
  }

  return actions;
}

function renderRow(item) {
  return el('tr', {}, [
    el('td', { text: formatDateTime(item.openedAt) }),
    el('td', {}, [
      el('span', { className: 'c-table__stack' }, [
        el('span', { className: 'u-text-mono', text: item.protocolNumber }),
        el('span', {
          className: 'c-table__secondary',
          text: `por ${item.insertedByName || '—'}`,
          attrs: { title: item.insertedByName || '—' },
        }),
      ]),
    ]),
    el('td', {}, [
      el('span', { className: 'c-table__stack' }, [
        truncated(item.requesterName),
        el('span', { className: 'c-table__secondary u-text-mono', text: item.requesterCardNumber || '—' }),
      ]),
    ]),
    el('td', {}, [
      el('span', { className: 'c-table__stack' }, [
        truncated(item.categoryName),
        el('span', { className: 'c-table__secondary', text: item.typeName || '—' }),
      ]),
    ]),
    el('td', { text: item.severityName || '—' }),
    el('td', {}, [statusBadge(item.statusName)]),
    el('td', {}, [truncated(item.assignedToName)]),
    el('td', { className: 'u-text-end' }, [el('div', { className: 'c-row-actions' }, rowActions(item))]),
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
 *   onView: (id: number, opener: HTMLElement) => void,
 *   onEdit: (id: number, opener: HTMLElement) => void,
 *   onFinish: (id: number, opener: HTMLElement) => void,
 *   onReopen: (id: number, opener: HTMLElement) => void,
 * }} callbacks
 */
export function initServiceRequestTable(root, { onSort, onView, onEdit, onFinish, onReopen }) {
  const wrapper = root.querySelector('.js-table-wrapper');
  const tbody = root.querySelector('.js-table-body');
  const stateArea = root.querySelector('.js-table-state');
  const sortableHeaders = [...root.querySelectorAll('th[data-sort-key]')];
  const handlers = { view: onView, edit: onEdit, finish: onFinish, reopen: onReopen };

  // Delegação: um listener para todos os botões de ordenação e de ação das linhas
  root.querySelector('thead').addEventListener('click', (event) => {
    const button = event.target.closest('.js-sort');
    if (button) onSort(button.closest('th').dataset.sortKey);
  });

  tbody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-request-id]');
    if (!button || button.disabled) return;
    const action = Object.keys(handlers).find((name) => button.classList.contains(`js-${name}`));
    if (action) handlers[action](Number(button.dataset.requestId), button);
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
      for (let i = 0; i < SKELETON_ROWS; i++) fragment.append(renderSkeletonRow());
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

    /** Foca uma ação da linha; false se a linha não está na página atual (ex.: saiu do filtro). */
    focusRowAction(id, selector) {
      const button = tbody.querySelector(`${selector}[data-request-id="${id}"]`);
      button?.focus();
      return Boolean(button);
    },

    focusResults() {
      const target = wrapper.hidden ? stateArea : wrapper;
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
      target.focus({ preventScroll: true });
    },
  };
}
