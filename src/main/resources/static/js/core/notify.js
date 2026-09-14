const DEFAULT_MESSAGES = {
  success: 'Operação realizada com sucesso.',
  error: 'Não foi possível concluir a operação.',
  warning: 'Atenção.',
  info: 'Informação.',
};

const DEDUPE_WINDOW_MS = 2000;
const recentMessages = new Map();
let notyf = null;

function token(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

// O Notyf insere a mensagem como HTML: SEMPRE escapar.
function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getInstance() {
  if (notyf) return notyf;

  notyf = new window.Notyf({
    duration: 4000,
    ripple: false,
    dismissible: true,
    position: { x: 'right', y: 'top' },
    types: [
      { type: 'success', background: token('--color-success', '#00804e'), duration: 4000 },
      { type: 'error',   background: token('--color-error',   '#b3261e'), duration: 7000 },
      { type: 'warning', background: token('--color-warning', '#a84a00'), duration: 6000, icon: false, className: 'c-toast--warning' },
      { type: 'info',    background: token('--color-info',    '#0b5f6a'), duration: 5000, icon: false, className: 'c-toast--info' },
    ],
  });

  return notyf;
}

function show(type, message) {
  const text = String(message ?? '').trim() || DEFAULT_MESSAGES[type];
  const now = Date.now();

  // Evita a mesma mensagem empilhada várias vezes (ex.: vários 401 simultâneos)
  if (now - (recentMessages.get(text) ?? 0) < DEDUPE_WINDOW_MS) return;
  recentMessages.set(text, now);

  getInstance().open({ type, message: escapeHtml(text) });
}

/**
 * Única porta de entrada para notificações do portal.
 */
export const notify = {
  success: (message) => show('success', message),
  error: (message) => show('error', message),
  warning: (message) => show('warning', message),
  info: (message) => show('info', message),
  dismissAll: () => getInstance().dismissAll(),
};
