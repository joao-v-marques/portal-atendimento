import { debounce } from '../core/dom.js';
import { clearFieldError, setFieldError } from '../core/form.js';
import { notify } from '../core/notify.js';
import { deadlineLevel, finishLead } from './service-request-table.js';

/** Nomes dos campos do formulário = chaves na query string. */
export const FILTER_KEYS = ['busca', 'status', 'tipo', 'categoria', 'responsavel', 'de', 'ate', 'prazo'];

// ── Dados (funções puras) ────────────────────────────────────

// Compara sem acento e sem maiúsculas: "joao" encontra "João"
function normalizeText(value) {
  return String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

const dayFormatter = new Intl.DateTimeFormat('en-CA'); // "AAAA-MM-DD", no fuso do navegador

// Dia de abertura no fuso do navegador, comparável com o valor do input date
function openedDay(item) {
  const date = new Date(item.openedAt);
  return Number.isNaN(date.getTime()) ? '' : dayFormatter.format(date);
}

/**
 * @param {Record<string, string>} filters
 */
export function hasActiveFilters(filters) {
  return FILTER_KEYS.some((key) => filters[key]);
}

/**
 * @param {Record<string, string>} filters
 * @returns {Record<string, string> | null} erros por campo, ou null
 */
export function validateFilters(filters) {
  if (filters.de && filters.ate && filters.de > filters.ate) {
    return { ate: 'A data final não pode ser anterior à data inicial.' };
  }
  return null;
}

/**
 * Aplica os filtros na lista completa (a API ainda não filtra).
 * @param {object[]} items
 * @param {Record<string, string>} filters
 */
export function applyFilters(items, filters) {
  const term = normalizeText(filters.busca);

  return items.filter((item) => {
    if (term) {
      const matches = normalizeText(item.protocolNumber).includes(term)
        || normalizeText(item.requesterName).includes(term)
        || normalizeText(item.requesterCardNumber).includes(term);
      if (!matches) return false;
    }
    if (filters.status && item.statusName !== filters.status) return false;
    if (filters.tipo && item.typeName !== filters.tipo) return false;
    if (filters.categoria && item.categoryName !== filters.categoria) return false;
    if (filters.responsavel && item.assignedToName !== filters.responsavel) return false;
    if (filters.de || filters.ate) {
      const day = openedDay(item);
      if (filters.de && day < filters.de) return false;
      if (filters.ate && day > filters.ate) return false;
    }
    // Mesma regra dos cards de prazo e do selo da tabela
    if (filters.prazo === 'avencer' && deadlineLevel(item) !== 'warning') return false;
    if (filters.prazo === 'vencido' && deadlineLevel(item) !== 'overdue') return false;
    const lead = filters.prazo ? finishLead(item) : null; // null: não finalizado
    if (filters.prazo === 'noprazo' && !(lead && lead.early >= 0)) return false;
    if (filters.prazo === 'comatraso' && !(lead && lead.early < 0)) return false;
    return true;
  });
}

// ── Formulário ───────────────────────────────────────────────

/**
 * @param {HTMLFormElement} form
 * @returns {Record<string, string>}
 */
export function readFilters(form) {
  return Object.fromEntries(FILTER_KEYS.map((key) => {
    const value = String(form.elements.namedItem(key)?.value ?? '');
    return [key, key === 'busca' ? value.trim() : value];
  }));
}

/**
 * @param {HTMLFormElement} form
 * @param {Record<string, string>} filters
 */
export function fillFilters(form, filters) {
  for (const key of FILTER_KEYS) {
    const field = form.elements.namedItem(key);
    if (field) field.value = filters[key] ?? '';
  }
}

function isTypingTarget(target) {
  return target instanceof Element && Boolean(target.closest('input, select, textarea, [contenteditable="true"]'));
}

/**
 * Liga os eventos do formulário de filtros (mesmo comportamento da tela de autorizações).
 * @param {HTMLFormElement} form
 * @param {{ onChange: (filters: Record<string, string>) => void }} callbacks
 * @returns {{ clear: () => void, replace: (values: Record<string, string>) => void }}
 */
export function initFilters(form, { onChange }) {
  const searchField = form.elements.namedItem('busca');
  const fromField = form.elements.namedItem('de');
  const toField = form.elements.namedItem('ate');
  const clearButton = form.querySelector('.js-clear-filters');

  function syncClearButton(filters) {
    clearButton.hidden = !hasActiveFilters(filters);
  }

  // Prevenir antes de corrigir: o calendário já não deixa escolher um período invertido
  function syncDateLimits() {
    toField.min = fromField.value;
    fromField.max = toField.value;
  }

  function emit() {
    const filters = readFilters(form);
    clearFieldError(fromField);
    clearFieldError(toField);
    syncDateLimits();

    const errors = validateFilters(filters);
    if (errors) {
      setFieldError(toField, errors.ate);
      notify.error('Revise o período informado.');
      return;
    }

    syncClearButton(filters);
    onChange(filters);
  }

  const emitDebounced = debounce(emit, 300);

  function clear() {
    form.reset();
    emit();
    searchField.focus();
  }

  // Troca todos os filtros pelos informados; chaves ausentes ficam vazias (ex.: atalho dos cards de prazo)
  function replace(values) {
    fillFilters(form, values);
    emit();
  }

  form.addEventListener('input', (event) => {
    if (event.target === searchField) emitDebounced();
  });

  form.addEventListener('change', (event) => {
    if (event.target !== searchField) emit();
  });

  // Enter na busca aplica na hora, sem esperar o debounce
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    emit();
  });

  clearButton.addEventListener('click', clear);

  // Atalho "/" foca a busca (ignorado enquanto a pessoa digita em outro campo ou há modal aberto)
  document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTypingTarget(event.target) || document.querySelector('dialog[open]')) return;
    event.preventDefault();
    searchField.focus();
  });

  syncDateLimits();
  syncClearButton(readFilters(form));

  return { clear, replace };
}
