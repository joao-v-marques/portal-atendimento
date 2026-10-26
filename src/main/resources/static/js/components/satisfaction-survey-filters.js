import { el } from '../core/dom.js';
import { clearFieldError, setFieldError } from '../core/form.js';

/** Nomes dos campos do formulário = chaves na query string. */
export const FILTER_KEYS = ['de', 'ate', 'diaSemana', 'nota', 'perg1', 'finalizador', 'status', 'horario'];

/** Filtros que ficam atrás do "Mais filtros" */
const EXTRA_KEYS = ['perg1', 'finalizador', 'status', 'horario'];

/** Valor das opções que filtram campo vazio no CSV */
export const EMPTY_VALUE = 'vazio';
export const NO_ANSWER = 'sem-resposta';
const VALID_GRADES = 'validas';

const WEEK_DAYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'];

// ── Dados (funções puras) ────────────────────────────────────

// "Sáb" e "sab" viram "SAB": o CSV não garante acento nem caixa
function normalizeWeekDay(value) {
  return String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().trim();
}

/** Nota "1".."5"; qualquer outro valor é sem resposta (mesma regra do backend) */
export function gradeOf(item) {
  const value = String(item.grade ?? '').trim();
  return /^[1-5]$/.test(value) ? value : NO_ANSWER;
}

/** Hora da resposta; cai para a hora do registro quando a coluna vem vazia */
export function answerHourOf(item) {
  return item.answerHour ?? Number.parseInt(String(item.hour ?? '').slice(0, 2), 10);
}

function valueOrEmpty(value) {
  return value === null || value === undefined || value === '' ? EMPTY_VALUE : String(value);
}

/**
 * @param {Record<string, string>} filters
 */
export function hasActiveFilters(filters) {
  return FILTER_KEYS.some((key) => filters[key]);
}

/**
 * @param {Record<string, string>} filters
 */
export function activeExtraCount(filters) {
  return EXTRA_KEYS.filter((key) => filters[key]).length;
}

/**
 * @param {Record<string, string>} filters
 * @returns {Record<string, string> | null} erros por campo, ou null
 */
export function validateFilters(filters) {
  if (filters.de && filters.ate && filters.de > filters.ate) {
    return { ate: 'A data até não pode ser antes da data de.' };
  }
  return null;
}

/**
 * Aplica os filtros na lista completa (a API só filtra por período).
 * @param {object[]} items
 * @param {Record<string, string>} filters
 */
export function applyFilters(items, filters) {
  return items.filter((item) => {
    // date é "AAAA-MM-DD": a comparação de texto já respeita a ordem das datas
    if (filters.de && item.date < filters.de) return false;
    if (filters.ate && item.date > filters.ate) return false;
    if (filters.diaSemana && normalizeWeekDay(item.weekDay) !== filters.diaSemana) return false;
    if (filters.nota === VALID_GRADES && gradeOf(item) === NO_ANSWER) return false;
    if (filters.nota && filters.nota !== VALID_GRADES && gradeOf(item) !== filters.nota) return false;
    if (filters.perg1 && valueOrEmpty(item.question1) !== filters.perg1) return false;
    if (filters.finalizador && valueOrEmpty(item.finisher?.trim()) !== filters.finalizador) return false;
    if (filters.status && valueOrEmpty(item.status) !== filters.status) return false;
    if (filters.horario && String(answerHourOf(item)) !== filters.horario) return false;
    return true;
  });
}

// ── Opções dos selects (montadas a partir dos dados) ─────────

function distinct(items, valueOf) {
  return [...new Set(items.map(valueOf))];
}

// Números em ordem numérica; o "vazio" vai para o fim
function byNumber(a, b) {
  if (a === EMPTY_VALUE) return 1;
  if (b === EMPTY_VALUE) return -1;
  return Number(a) - Number(b);
}

/**
 * Valores existentes em cada filtro, já ordenados e com rótulo.
 * @param {object[]} items
 * @returns {Record<string, { value: string, label: string }[]>}
 */
export function filterOptions(items) {
  const emptyLabel = (value, label) => (value === EMPTY_VALUE ? 'Não informado' : label);

  return {
    diaSemana: distinct(items, (item) => normalizeWeekDay(item.weekDay))
      .filter(Boolean)
      .sort((a, b) => (WEEK_DAYS.indexOf(a) + 1 || 99) - (WEEK_DAYS.indexOf(b) + 1 || 99))
      .map((value) => ({ value, label: value === 'SAB' ? 'SÁB' : value })),
    perg1: distinct(items, (item) => valueOrEmpty(item.question1))
      .sort(byNumber)
      .map((value) => ({ value, label: emptyLabel(value, value) })),
    finalizador: distinct(items, (item) => valueOrEmpty(item.finisher?.trim()))
      .sort((a, b) => (a === EMPTY_VALUE) - (b === EMPTY_VALUE) || a.localeCompare(b, 'pt-BR'))
      .map((value) => ({ value, label: emptyLabel(value, value) })),
    status: distinct(items, (item) => valueOrEmpty(item.status))
      .sort(byNumber)
      .map((value) => ({ value, label: emptyLabel(value, value) })),
    horario: distinct(items, (item) => String(answerHourOf(item)))
      .filter((value) => value !== 'NaN')
      .sort(byNumber)
      .map((value) => ({ value, label: `${value.padStart(2, '0')}h às ${value.padStart(2, '0')}h59` })),
  };
}

/**
 * Preenche um select mantendo a primeira opção ("Todos") e o valor atual.
 * @param {HTMLSelectElement} select
 * @param {{ value: string, label: string }[]} options
 * @param {string} selected
 */
function populateSelect(select, options, selected = '') {
  // Valor vindo da URL que não existe nos dados continua visível, senão o filtro ficaria "invisível"
  const list = selected && !options.some((option) => option.value === selected)
    ? [...options, { value: selected, label: selected }]
    : options;

  const [allOption] = select.options;
  select.replaceChildren(allOption, ...list.map(({ value, label }) => el('option', { text: label, attrs: { value } })));
  select.value = selected;
  select.disabled = false;
}

// ── Formulário ───────────────────────────────────────────────

/**
 * @param {HTMLFormElement} form
 * @returns {Record<string, string>}
 */
export function readFilters(form) {
  return Object.fromEntries(FILTER_KEYS.map((key) => [key, String(form.elements.namedItem(key)?.value ?? '')]));
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
 * Liga os eventos do formulário de filtros.
 * @param {HTMLFormElement} form
 * @param {{ onChange: (filters: Record<string, string>) => void }} callbacks
 * @returns {{
 *   clear: () => void,
 *   setOptions: (items: object[], filters: Record<string, string>) => void,
 * }}
 */
export function initFilters(form, { onChange }) {
  const fromField = form.elements.namedItem('de');
  const toField = form.elements.namedItem('ate');
  const clearButton = form.querySelector('.js-clear-filters');
  const extraToggle = form.querySelector('.js-extra-toggle');
  const extraPanel = form.querySelector('.js-extra-filters');
  const extraCount = form.querySelector('.js-extra-count');

  function setExtraOpen(isOpen) {
    extraToggle.setAttribute('aria-expanded', String(isOpen));
    extraPanel.hidden = !isOpen;
  }

  // Botão "Limpar" e contador do "Mais filtros" (mostra quantos estão ativos mesmo com o painel fechado)
  function syncIndicators(filters) {
    clearButton.hidden = !hasActiveFilters(filters);
    const count = activeExtraCount(filters);
    extraCount.textContent = count ? String(count) : '';
    extraCount.hidden = count === 0;
  }

  // Prevenir antes de corrigir: o calendário já não deixa escolher um período invertido
  function syncDateLimits() {
    toField.min = fromField.value;
    fromField.max = toField.value;
  }

  function emit() {
    const filters = readFilters(form);
    clearFieldError(toField);
    syncDateLimits();

    const errors = validateFilters(filters);
    if (errors) {
      setFieldError(toField, errors.ate);
      return;
    }

    syncIndicators(filters);
    onChange(filters);
  }

  function clear() {
    form.reset();
    emit();
    fromField.focus();
  }

  form.addEventListener('change', emit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    emit();
  });
  clearButton.addEventListener('click', clear);
  extraToggle.addEventListener('click', () => {
    setExtraOpen(extraToggle.getAttribute('aria-expanded') !== 'true');
  });

  syncDateLimits();
  syncIndicators(readFilters(form));
  setExtraOpen(false);

  return {
    clear,

    /** Preenche os selects com os valores que existem nos dados carregados */
    setOptions(items, filters) {
      const options = filterOptions(items);
      for (const [key, list] of Object.entries(options)) {
        populateSelect(form.elements.namedItem(key), list, filters[key]);
      }
      // Só agora os selects têm o valor da URL: atualiza os indicadores e abre o painel
      // se houver filtro extra ativo, para ninguém ficar com um filtro escondido
      syncIndicators(filters);
      if (activeExtraCount(filters) > 0) setExtraOpen(true);
    },
  };
}
