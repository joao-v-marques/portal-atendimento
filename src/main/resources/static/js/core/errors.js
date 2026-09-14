import { ApiRequestError } from './api.js';
import { notify } from './notify.js';
import { showFieldErrors } from './form.js';

const FALLBACK_BY_STATUS = {
  0:   'Sem conexão com o servidor.',
  400: 'Revise os dados informados.',
  403: 'Você não tem permissão para esta ação.',
  404: 'Registro não encontrado.',
  409: 'Já existe um registro com esses dados.',
  413: 'Os arquivos excedem o tamanho máximo permitido.',
};
const FALLBACK_SERVER = 'Erro inesperado. Tente novamente em instantes.';

/**
 * Converte qualquer erro em feedback ao usuário.
 * @param {unknown} error
 * @param {{ form?: HTMLFormElement, redirectOn401?: boolean }} [options]
 */
export function handleError(error, { form, redirectOn401 = true } = {}) {
  if (error?.name === 'AbortError') return; // requisição cancelada de propósito

  if (!(error instanceof ApiRequestError)) {
    console.error(error); // log para desenvolvimento; o usuário vê só a mensagem genérica
    notify.error(FALLBACK_SERVER);
    return;
  }

  if (error.status === 401 && redirectOn401) {
    window.location.assign('login?erro=sessao-expirada');
    return;
  }

  const fallback = error.status >= 500 ? FALLBACK_SERVER : FALLBACK_BY_STATUS[error.status];
  notify.error(error.message || fallback || FALLBACK_SERVER);

  if (form && Object.keys(error.fields).length > 0) {
    showFieldErrors(form, error.fields);
  }
}
