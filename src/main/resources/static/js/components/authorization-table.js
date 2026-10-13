import { el } from '../core/dom.js';
import { businessDaysSince, formatDate, formatPhone, statusVariant } from '../core/format.js';

export const SORTABLE_KEYS = ['requestDate', 'transactionNumber', 'beneficiaryName', 'authorizationStatusName', 'createdAt'];
export const DEFAULT_SORT = { key: 'requestDate', direction: 'desc' };

const DATE_KEYS = new Set(['requestDate', 'createdAt']);
const COLUMN_COUNT = 7;
const SKELETON_ROWS = 5;

// Prazo da ANS: 10 dias úteis desde a solicitação. A partir de 8 o aviso é preventivo; em 10 já venceu
export const DEADLINE_WARNING_BUSINESS_DAYS = 8;
export const DEADLINE_LIMIT_BUSINESS_DAYS = 10;

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
 * Situação da autorização diante do prazo da ANS, contado em dias úteis desde a solicitação.
 * @param {{ requestDate?: string, authorizationStatusName?: string }} item
 * @returns {'done' | 'overdue' | 'warning' | 'ok'}
 */
export function deadlineLevel(item) {
  if (statusVariant(item.authorizationStatusName) === 'done') return 'done';
  const days = businessDaysSince(item.requestDate) ?? 0;
  if (days >= DEADLINE_LIMIT_BUSINESS_DAYS) return 'overdue';
  if (days >= DEADLINE_WARNING_BUSINESS_DAYS) return 'warning';
  return 'ok';
}

/**
 * Antecedência da finalização frente ao prazo da ANS, em dias úteis.
 * early > 0: antecedência; 0: no último dia; < 0: atraso.
 * @param {{ requestDate?: string, finishDate?: string | null }} item
 * @returns {{ used: number, early: number } | null} null para pedidos sem finishDate (finalizados antes da data existir)
 */
export function finishLead(item) {
  if (!item.finishDate) return null;
  const [y, m, d] = item.finishDate.split('-').map(Number);
  const used = businessDaysSince(item.requestDate, new Date(y, m - 1, d)) ?? 0;
  return { used, early: DEADLINE_LIMIT_BUSINESS_DAYS - used };
}

function businessDaysLabel(days) {
  return `${days} ${days === 1 ? 'dia útil' : 'dias úteis'}`;
}

/**
 * "5 dias úteis de antecedência" / "no último dia do prazo" / "2 dias úteis de atraso".
 * @param {{ early: number }} lead
 */
export function finishLeadText({ early }) {
  if (early > 0) return `${businessDaysLabel(early)} de antecedência`;
  if (early === 0) return 'no último dia do prazo';
  return `${businessDaysLabel(-early)} de atraso`;
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
 * Linha de baixo do Cadastro: dias úteis desde a solicitação ou, se finalizada,
 * a antecedência (ou atraso) frente ao prazo da ANS.
 * @param {{ requestDate?: string, finishDate?: string | null, authorizationStatusName?: string }} item
 */
function deadlineInfo(item) {
  const level = deadlineLevel(item);
  if (level === 'done') {
    const lead = finishLead(item);
    if (!lead) {
      return el('span', { className: 'c-table__secondary c-table__deadline--done', text: 'Finalizado' });
    }

    // Selo curto na célula; a frase completa fica no title (mouse) e no texto oculto (leitor de tela)
    const isLate = lead.early < 0;
    const days = Math.abs(lead.early);
    const shortText = lead.early === 0
      ? 'No limite do prazo'
      : `${businessDaysLabel(days)} ${isLate ? 'de atraso' : 'antes do prazo'}`;
    const fullText = lead.early === 0
      ? `Autorizado em ${formatDate(item.finishDate)}, no último dia do prazo da ANS`
      : `Autorizado em ${formatDate(item.finishDate)}, com ${finishLeadText(lead)} em relação ao prazo da ANS`;

    return el('span', {
      className: `c-table__lead c-table__lead--${isLate ? 'late' : 'on-time'}`,
      attrs: { title: fullText },
    }, [
      el('span', { className: `c-icon c-icon--sm c-icon--${isLate ? 'alert' : 'check-circle'}`, attrs: { 'aria-hidden': 'true' } }),
      el('span', { text: shortText, attrs: { 'aria-hidden': 'true' } }),
      el('span', { className: 'u-visually-hidden', text: fullText }),
    ]);
  }

  const days = businessDaysSince(item.requestDate);
  if (days === null) return el('span', { className: 'c-table__secondary', text: '—' });

  const text = days === 0 ? 'Criado hoje' : `Criado há ${days} ${days === 1 ? 'dia útil' : 'dias úteis'}`;
  if (level === 'ok') return el('span', { className: 'c-table__secondary', text });

  // Cor não é o único sinal: ícone na tela e aviso para leitor de tela
  const isOverdue = level === 'overdue';
  return el('span', { className: `c-table__secondary c-table__deadline--${isOverdue ? 'late' : 'warning'}` }, [
    el('span', { className: 'c-icon c-icon--sm c-icon--alert', attrs: { 'aria-hidden': 'true' } }),
    text,
    el('span', {
      className: 'u-visually-hidden',
      text: isOverdue ? ' (prazo da ANS vencido)' : ' (prazo da ANS prestes a vencer)',
    }),
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

  // Já finalizada não tem o que finalizar: o backend recusaria e a coluna Cadastro já diz "Finalizado"
  const actions = [viewButton];
  if (deadlineLevel(item) !== 'done') {
    actions.push(el('button', {
      className: 'c-button c-button--secondary c-button--sm js-finish',
      attrs: {
        type: 'button',
        'data-request-id': String(item.id),
        'aria-label': `Finalizar a autorização ${item.transactionNumber}`,
      },
    }, [
      el('span', { className: 'c-icon c-icon--sm c-icon--check-circle', attrs: { 'aria-hidden': 'true' } }),
      'Finalizar',
    ]));
  }

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
    el('td', { className: 'u-text-end' }, [el('div', { className: 'c-row-actions' }, actions)]),
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
 *   onFinish: (id: number, opener: HTMLElement) => void,
 * }} callbacks
 */
export function initAuthorizationTable(root, { onSort, onView, onFinish }) {
  const wrapper = root.querySelector('.js-table-wrapper');
  const tbody = root.querySelector('.js-table-body');
  const stateArea = root.querySelector('.js-table-state');
  const sortableHeaders = [...root.querySelectorAll('th[data-sort-key]')];

  // Delegação: um listener para todos os botões de ordenação e de ação das linhas
  root.querySelector('thead').addEventListener('click', (event) => {
    const button = event.target.closest('.js-sort');
    if (button) onSort(button.closest('th').dataset.sortKey);
  });

  tbody.addEventListener('click', (event) => {
    const viewButton = event.target.closest('.js-view');
    if (viewButton) onView(Number(viewButton.dataset.requestId), viewButton);

    const finishButton = event.target.closest('.js-finish');
    if (finishButton && !finishButton.disabled) onFinish(Number(finishButton.dataset.requestId), finishButton);
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
