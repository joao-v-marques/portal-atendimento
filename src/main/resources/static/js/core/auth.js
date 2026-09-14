import { api } from './api.js';
import { notify } from './notify.js';

let currentUserPromise = null;

/**
 * Usuário logado ({ name, username, role }). A resposta fica em memória
 * para topbar e página dividirem uma única chamada.
 * @returns {Promise<{ name: string | null, username: string, role: string }>}
 */
export function getCurrentUser() {
  currentUserPromise ??= api.get('api/auth/me').catch((error) => {
    currentUserPromise = null; // permite tentar de novo depois de uma falha
    throw error;
  });
  return currentUserPromise;
}

/**
 * Encerra a sessão (apaga o cookie no backend) e volta para o login.
 * Erros sobem para quem chamou tratar com handleError().
 */
export async function logout() {
  await api.post('api/auth/logout');
  window.location.assign('login');
}

const LOGIN_REASONS = {
  'sessao-expirada': () => notify.warning('Sua sessão expirou. Entre novamente.'),
  'login-necessario': () => notify.info('Entre para continuar.'),
};

/**
 * Mostra o motivo do redirecionamento para o login (`?erro=`) e limpa a URL
 * para o aviso não se repetir ao recarregar a página.
 */
export function showLoginReasonFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const reason = params.get('erro');
  if (reason === null) return;

  LOGIN_REASONS[reason]?.();
  params.delete('erro');
  const query = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
}
