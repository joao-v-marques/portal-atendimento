import { displayName, initAppShell } from '../components/app-shell.js';
import { deadlineLevel } from '../components/authorization-table.js';
import { api } from '../core/api.js';
import { handleError } from '../core/errors.js';
import { formatLongDate } from '../core/format.js';

const numberFormatter = new Intl.NumberFormat('pt-BR');

const greetingEl = document.querySelector('.js-greeting');
const todayEl = document.querySelector('.js-today');
const metrics = document.querySelector('.js-metrics');
const totalCountEl = metrics.querySelector('.js-total-count');
const warningCountEl = metrics.querySelector('.js-warning-count');
const overdueCountEl = metrics.querySelector('.js-overdue-count');

function firstName(user) {
  return displayName(user).split(/\s+/)[0];
}

function renderGreeting(text) {
  greetingEl.textContent = text; // substitui o skeleton
  greetingEl.removeAttribute('aria-busy');
}

function renderCount(countEl, text) {
  countEl.textContent = text; // substitui o skeleton
  countEl.removeAttribute('aria-busy');
}

// ── Indicadores ──────────────────────────────────────────────

// Mesma contagem dos cards de prazo em /autorizacoes: os números precisam bater entre as páginas
async function loadMetrics() {
  try {
    const items = await api.get('api/authorization-requests');
    const levels = items.map(deadlineLevel);
    renderCount(totalCountEl, numberFormatter.format(items.length));
    renderCount(warningCountEl, numberFormatter.format(levels.filter((level) => level === 'warning').length));
    renderCount(overdueCountEl, numberFormatter.format(levels.filter((level) => level === 'overdue').length));
  } catch (error) {
    [totalCountEl, warningCountEl, overdueCountEl].forEach((countEl) => renderCount(countEl, '—'));
    handleError(error);
  }
}

// ── Inicialização ────────────────────────────────────────────

const now = new Date();
todayEl.textContent = formatLongDate(now);

initAppShell()
  .then((user) => {
    const name = firstName(user);
    renderGreeting(name ? `Olá, ${name}` : 'Olá!');
  })
  // O shell já notificou o erro; aqui só evita o skeleton eterno
  .catch(() => renderGreeting('Olá!'));

loadMetrics();
