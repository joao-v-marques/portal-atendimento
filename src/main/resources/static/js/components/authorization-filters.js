import { debounce, el } from '../core/dom.js';
import { clearFieldError, setFieldError } from '../core/form.js';
import { onlyDigits } from '../core/format.js';
import { notify } from '../core/notify.js';
import { deadlineLevel } from './authorization-table.js';

/** Nomes dos campos do formulário = chaves na query string. */
export const FILTER_KEYS = ['busca', 'status', 'tipo', 'de', 'ate', 'cadastradoPor', 'prazo'];

const PHONE_LIKE = /^[\d\s()+-]+$/;

// ── Dados (funções puras) ────────────────────────────────────

// Compara sem acento e sem maiúsculas: "joao" encontra "João"
function normalizeText(value) {
  return String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
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
  // Telefone só entra na busca quando o termo parece número: evita "Maria 11" casar por dígitos soltos
  const phoneDigits = PHONE_LIKE.test(filters.busca) ? onlyDigits(filters.busca) : '';

  return items.filter((item) => {
    if (term) {
      const matches = normalizeText(item.transactionNumber).includes(term)
        || normalizeText(item.beneficiaryName).includes(term)
        || (phoneDigits !== '' && onlyDigits(item.beneficiaryPhone).includes(phoneDigits));
      if (!matches) return false;
    }
    if (filters.status && item.authorizationStatusName !== filters.status) return false;
    if (filters.tipo && item.authorizationTypeName !== filters.tipo) return false;
    if (filters.cadastradoPor && item.insertedByName !== filters.cadastradoPor) return false;
    // requestDate é "AAAA-MM-DD": a comparação de texto já respeita a ordem das datas
    if (filters.de && item.requestDate < filters.de) return false;
    if (filters.ate && item.requestDate > filters.ate) return false;
    // Mesma regra dos cards de prazo e da cor da linha na tabela
    if (filters.prazo === 'avencer' && deadlineLevel(item) !== 'warning') return false;
    if (filters.prazo === 'vencida' && deadlineLevel(item) !== 'overdue') return false;
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

/**
 * Preenche um select mantendo a primeira opção ("Todos") e o valor atual.
 * @param {HTMLSelectElement} select
 * @param {string[]} names
 * @param {string} selected
 */
export function populateSelect(select, names, selected = '') {
  const options = [...new Set(names.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  // Valor vindo da URL que não existe mais continua visível, senão o filtro ficaria "invisível"
  if (selected && !options.includes(selected)) options.push(selected);

  const [allOption] = select.options;
  select.replaceChildren(allOption, ...options.map((name) => el('option', { text: name, attrs: { value: name } })));
  select.value = selected;
  select.disabled = false;
}

function isTypingTarget(target) {
  return target instanceof Element && Boolean(target.closest('input, select, textarea, [contenteditable="true"]'));
}

/**
 * Liga os eventos do formulário de filtros.
 * @param {HTMLFormElement} form
 * @param {{ onChange: (filters: Record<string, string>) => void }} callbacks
 * @returns {{
 *   clear: () => void,
 *   replace: (values: Record<string, string>) => void,
 *   syncClearButton: (filters: Record<string, string>) => void,
 * }}
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

  // Troca todos os filtros pelos informados; chaves ausentes ficam vazias (ex.: atalho da faixa de prazo)
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

  return { clear, replace, syncClearButton };
}
