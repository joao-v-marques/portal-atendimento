import { el } from '../core/dom.js';
import { businessDaysSinceDateTime, formatDateTime } from '../core/format.js';
import { statusBadge } from './authorization-table.js';

export const SORTABLE_KEYS = ['openedAt', 'protocolNumber', 'requesterName', 'statusName', 'assignedToName'];
export const DEFAULT_SORT = { key: 'openedAt', direction: 'desc' };

// Status de sistema "Finalizado", mesmo id do STATUS_FINISHED_ID do ServiceRequestService (seed da V7)
export const FINISHED_STATUS_ID = 2;

// Prazo: 5 dias úteis desde a abertura (sem feriados). No 4º e 5º o aviso é preventivo; do 6º em diante venceu
export const DEADLINE_DAYS = 5;
export const DEADLINE_WARNING_DAYS = 4;

const DAY_MS = 24 * 60 * 60 * 1000;
const shortDateFormatter = new Intl.DateTimeFormat('pt-BR');
const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });

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

/**
 * Situação do atendimento diante do prazo de 5 dias úteis desde a abertura.
 * @param {{ statusId?: number, openedAt?: string }} item
 * @returns {'done' | 'overdue' | 'warning' | 'ok'}
 */
export function deadlineLevel(item) {
  if (isFinished(item)) return 'done';
  const days = businessDaysSinceDateTime(item.openedAt) ?? 0;
  if (days > DEADLINE_DAYS) return 'overdue';
  if (days >= DEADLINE_WARNING_DAYS) return 'warning';
  return 'ok';
}

/**
 * Folga da finalização frente ao prazo, em dias úteis.
 * early > 0: antecedência; 0: no último dia; < 0: atraso.
 * @param {{ openedAt?: string, closedAt?: string | null }} item
 * @returns {{ used: number, early: number } | null} null quando não há closedAt
 */
export function finishLead(item) {
  if (!item.closedAt) return null;
  const used = businessDaysSinceDateTime(item.openedAt, new Date(item.closedAt)) ?? 0;
  return { used, early: DEADLINE_DAYS - used };
}

/**
 * Último dia do prazo: o 5º dia útil depois do dia da abertura, no fuso do navegador.
 * @param {{ openedAt?: string }} item
 * @returns {Date | null}
 */
function deadlineDate(item) {
  const opened = new Date(item.openedAt);
  if (Number.isNaN(opened.getTime())) return null;
  const date = new Date(opened.getFullYear(), opened.getMonth(), opened.getDate());
  for (let added = 0; added < DEADLINE_DAYS;) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) added++;
  }
  return date;
}

/**
 * Último dia do prazo ("26/10/2026").
 * @param {{ openedAt?: string }} item
 */
export function deadlineDateText(item) {
  const date = deadlineDate(item);
  return date ? shortDateFormatter.format(date) : '—';
}

// "Vence hoje" / "Vence amanhã" / "Vence seg." (fim de semana no meio: amanhã não é o dia útil seguinte)
function dueText(item) {
  const due = deadlineDate(item);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((due - today) / DAY_MS);
  if (diff <= 0) return 'Vence hoje';
  if (diff === 1) return 'Vence amanhã';
  return `Vence ${weekdayFormatter.format(due)}`;
}

function daysLabel(days) {
  return `${days} ${days === 1 ? 'dia útil' : 'dias úteis'}`;
}

// 0 dias úteis também acontece no fim de semana (aberto sábado, hoje domingo)
function openedAgoText(days) {
  return days === 0 ? 'aberto há menos de 1 dia útil' : `aberto há ${daysLabel(days)}`;
}

// Selo com ícone: a cor nunca é o único sinal. Frase completa no title (mouse) e no texto oculto (leitor de tela)
function deadlinePill(variant, icon, shortText, fullText) {
  return el('span', { className: `c-table__lead c-table__lead--${variant}`, attrs: { title: fullText } }, [
    el('span', { className: `c-icon c-icon--sm c-icon--${icon}`, attrs: { 'aria-hidden': 'true' } }),
    el('span', { text: shortText, attrs: { 'aria-hidden': 'true' } }),
    el('span', { className: 'u-visually-hidden', text: fullText }),
  ]);
}

/**
 * Situação do prazo para a tabela e o detalhe: há quantos dias está aberto ou,
 * se finalizado, quantos dias antes (verde) ou depois (vermelho) do prazo.
 * @param {{ statusId?: number, openedAt?: string, closedAt?: string | null }} item
 */
export function deadlineInfo(item) {
  const level = deadlineLevel(item);

  if (level === 'done') {
    const lead = finishLead(item);
    if (!lead) return el('span', { className: 'c-table__secondary c-table__deadline--done', text: 'Finalizado' });

    const closed = `Finalizado em ${formatDateTime(item.closedAt)}, ${lead.used === 0 ? 'antes de completar 1 dia útil' : `${daysLabel(lead.used)} após a abertura`}`;
    if (lead.early > 0) {
      return deadlinePill('on-time', 'check-circle', `${daysLabel(lead.early)} antes do prazo`,
        `${closed}: ${daysLabel(lead.early)} antes do prazo de ${DEADLINE_DAYS} dias úteis`);
    }
    if (lead.early === 0) {
      return deadlinePill('on-time', 'check-circle', 'No limite do prazo', `${closed}: no último dia útil do prazo`);
    }
    return deadlinePill('late', 'alert', `${daysLabel(-lead.early)} de atraso`,
      `${closed}: ${daysLabel(-lead.early)} depois do prazo de ${DEADLINE_DAYS} dias úteis`);
  }

  const days = businessDaysSinceDateTime(item.openedAt);
  if (days === null) return el('span', { className: 'c-table__secondary', text: '—' });

  const opened = days === 0 && new Date(item.openedAt).toDateString() === new Date().toDateString()
    ? 'aberto hoje'
    : openedAgoText(days);
  if (level === 'ok') {
    return el('span', { className: 'c-table__secondary', text: opened.charAt(0).toUpperCase() + opened.slice(1) });
  }

  if (level === 'overdue') {
    const late = days - DEADLINE_DAYS;
    return deadlinePill('late', 'alert', `Vencido · há ${daysLabel(days)}`,
      `Prazo vencido: ${opened}, ${daysLabel(late)} além do prazo de ${DEADLINE_DAYS} dias úteis`);
  }

  const due = dueText(item);
  return el('span', {
    className: 'c-table__secondary c-table__deadline--warning',
    attrs: { title: `${due} (${deadlineDateText(item)}): ${opened}` },
  }, [
    el('span', { className: 'c-icon c-icon--sm c-icon--alert', attrs: { 'aria-hidden': 'true' } }),
    `${due} · há ${daysLabel(days)}`,
    el('span', { className: 'u-visually-hidden', text: ` (prazo de ${DEADLINE_DAYS} dias úteis prestes a vencer)` }),
  ]);
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
    el('td', {}, [
      el('span', { className: 'c-table__stack' }, [
        el('span', { text: formatDateTime(item.openedAt) }),
        deadlineInfo(item),
      ]),
    ]),
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
