import { displayName, initAppShell } from '../components/app-shell.js';
import { formatLongDate } from '../core/format.js';

const greetingEl = document.querySelector('.js-greeting');
const todayEl = document.querySelector('.js-today');

function greetingFor(hour) {
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function firstName(user) {
  return displayName(user).split(/\s+/)[0];
}

function renderGreeting(text) {
  greetingEl.textContent = text; // substitui o skeleton
  greetingEl.removeAttribute('aria-busy');
}

// ── Inicialização ────────────────────────────────────────────

const now = new Date();
todayEl.textContent = formatLongDate(now);

initAppShell()
  .then((user) => {
    const name = firstName(user);
    renderGreeting(name ? `${greetingFor(now.getHours())}, ${name}.` : `${greetingFor(now.getHours())}!`);
  })
  // O shell já notificou o erro; aqui só evita o skeleton eterno
  .catch(() => renderGreeting('Olá!'));
