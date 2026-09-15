import { el } from '../core/dom.js';
import { businessDaysSince, formatDate, formatPhone, statusVariant } from '../core/format.js';

export const SORTABLE_KEYS = ['requestDate', 'transactionNumber', 'beneficiaryName', 'authorizationStatusName', 'createdAt'];
export const DEFAULT_SORT = { key: 'requestDate', direction: 'desc' };

const DATE_KEYS = new Set(['requestDate', 'createdAt']);
const COLUMN_COUNT = 7;
const SKELETON_ROWS = 5;

// Prazo da ANS: 10 dias úteis desde a solicitação. A partir de 7 a linha já pede atenção
export const DEADLINE_WARNING_BUSINESS_DAYS = 7;

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

// ── Dados ────────────────────────────────────────────────────

function compareValues(key, a, b) {
  const left = String(a[key] ?? '');
  const right = String(b[key] ?? '');
  // Datas ISO ordenam como texto; nomes usam o collator (acentos e números naturais)
  if (DATE_KEYS.has(key)) return left < right ? -1 : left > right ? 1 : 0;
  return collator.compare(left, right);
}

/**
 * Não finalizada e com DEADLINE_WARNING_BUSINESS_DAYS+ dias úteis desde a solicitação (prazo ANS).
 * @param {{ requestDate?: string, authorizationStatusName?: string }} item
 */
export function isDeadlineAtRisk(item) {
  if (statusVariant(item.authorizationStatusName) === 'done') return false;
  return (businessDaysSince(item.requestDate) ?? 0) >= DEADLINE_WARNING_BUSINESS_DAYS;
}

/**
 * Ordena sem alterar a lista original. Empate: mais recente primeiro.
 * @param {object[]} items
 * @param {{ key: string, direction: 'asc' | 'desc' }} sort
 */
export function sortItems(items, { key, direction }) {
  const factor = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) =>
    compareValues(key, a, b) * factor || compareValues('createdAt', b, a));
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

// ── Elementos reutilizáveis ──────────────────────────────────

/**
 * Badge com o nome do status (o ponto colorido é só complemento).
 * @param {string} statusName
 */
export function statusBadge(statusName) {
  return el('span', {
    className: `c-badge c-badge--status-${statusVariant(statusName)}`,
    text: statusName || '—',
  });
}

/**
 * Estado vazio / erro exibido no lugar da tabela.
 * @param {{ icon: string, title: string, text: string, actions?: HTMLElement[] }} options
 */
export function emptyState({ icon, title, text, actions = [] }) {
  return el('div', { className: 'c-card c-empty-state' }, [
    el('span', { className: 'c-empty-state__icon', attrs: { 'aria-hidden': 'true' } }, [
      el('span', { className: `c-icon c-icon--${icon}` }),
    ]),
    el('h3', { className: 'c-empty-state__title', text: title }),
    el('p', { className: 'c-empty-state__text', text }),
    ...(actions.length ? [el('div', { className: 'c-empty-state__actions' }, actions)] : []),
  ]);
}

function truncated(text) {
  const value = text || '—';
  return el('span', { className: 'c-table__truncate', text: value, attrs: { title: value } });
}

/**
 * Linha de baixo do Cadastro: dias úteis desde a solicitação ou "Finalizado".
 * @param {{ requestDate?: string, authorizationStatusName?: string }} item
 */
function deadlineInfo(item) {
  if (statusVariant(item.authorizationStatusName) === 'done') {
    return el('span', { className: 'c-table__secondary c-table__deadline--done', text: 'Finalizado' });
  }

  const days = businessDaysSince(item.requestDate);
  if (days === null) return el('span', { className: 'c-table__secondary', text: '—' });

  const text = days === 0 ? 'Criado hoje' : `Criado há ${days} ${days === 1 ? 'dia útil' : 'dias úteis'}`;
  if (days < DEADLINE_WARNING_BUSINESS_DAYS) return el('span', { className: 'c-table__secondary', text });

  // Cor não é o único sinal: ícone na tela e aviso para leitor de tela
  return el('span', { className: 'c-table__secondary c-table__deadline--late' }, [
    el('span', { className: 'c-icon c-icon--sm c-icon--alert', attrs: { 'aria-hidden': 'true' } }),
    text,
    el('span', { className: 'u-visually-hidden', text: ' (atenção ao prazo da ANS)' }),
  ]);
}

function renderRow(item) {
  const viewButton = el('button', {
    className: 'c-button c-button--ghost c-button--sm js-view',
    attrs: {
      type: 'button',
      'data-request-id': String(item.id),
      'aria-label': `Ver detalhes da autorização ${item.transactionNumber}`,
    },
  }, [
    el('span', { className: 'c-icon c-icon--sm c-icon--eye', attrs: { 'aria-hidden': 'true' } }),
    'Detalhes',
  ]);

  return el('tr', {}, [
    el('td', { text: formatDate(item.requestDate) }),
    el('td', {}, [
      el('span', { className: 'c-table__stack' }, [
        el('span', { className: 'u-text-mono', text: item.transactionNumber }),
        el('span', {
          className: 'c-table__secondary',
          text: `por ${item.insertedByName || '—'}`,
          attrs: { title: item.insertedByName || '—' },
        }),
      ]),
    ]),
    el('td', {}, [
      el('span', { className: 'c-table__stack' }, [
        truncated(item.beneficiaryName),
        el('span', { className: 'c-table__secondary', text: formatPhone(item.beneficiaryPhone) }),
      ]),
    ]),
    el('td', {}, [truncated(item.authorizationTypeName)]),
    el('td', {}, [statusBadge(item.authorizationStatusName)]),
    el('td', {}, [
      el('span', { className: 'c-table__stack' }, [
        el('span', { text: formatDate(item.requestDate) }),
        deadlineInfo(item),
      ]),
    ]),
    el('td', { className: 'u-text-end' }, [viewButton]),
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
 * @param {{ onSort: (key: string) => void, onView: (id: number, opener: HTMLElement) => void }} callbacks
 */
export function initAuthorizationTable(root, { onSort, onView }) {
  const wrapper = root.querySelector('.js-table-wrapper');
  const tbody = root.querySelector('.js-table-body');
  const stateArea = root.querySelector('.js-table-state');
  const sortableHeaders = [...root.querySelectorAll('th[data-sort-key]')];

  // Delegação: um listener para todos os botões de ordenação e de detalhe
  root.querySelector('thead').addEventListener('click', (event) => {
    const button = event.target.closest('.js-sort');
    if (button) onSort(button.closest('th').dataset.sortKey);
  });

  tbody.addEventListener('click', (event) => {
    const button = event.target.closest('.js-view');
    if (button) onView(Number(button.dataset.requestId), button);
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

    focusResults() {
      const target = wrapper.hidden ? stateArea : wrapper;
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
      target.focus({ preventScroll: true });
    },
  };
}
