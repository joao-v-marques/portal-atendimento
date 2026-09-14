const DEFAULT_TIMEOUT_MS = 20000;
const UPLOAD_TIMEOUT_MS = 120000;

export class ApiRequestError extends Error {
  constructor(status, message, fields = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status; // 0 = rede/timeout
    this.fields = fields;
  }
}

async function parseBody(response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => null);
  }
  return null;
}

// Content-Disposition: prefere filename* (UTF-8, RFC 5987) e cai para filename="..."
function filenameFrom(response) {
  const header = response.headers.get('Content-Disposition') ?? '';
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1]);
    } catch {
      // nome malformado: tenta o formato simples abaixo
    }
  }
  return header.match(/filename="?([^";]+)"?/i)?.[1] ?? 'documento';
}

async function request(path, { method = 'GET', body, signal, timeout, responseType = 'json' } = {}) {
  const isFormData = body instanceof FormData;
  const isBlob = responseType === 'blob';
  const timeoutController = new AbortController();
  const timer = setTimeout(
    () => timeoutController.abort(),
    timeout ?? (isFormData || isBlob ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS),
  );

  const headers = { Accept: isBlob ? '*/*' : 'application/json' };
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(path, { // path RELATIVO: 'api/users'
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
      credentials: 'same-origin',
      signal: signal ? AbortSignal.any([signal, timeoutController.signal]) : timeoutController.signal,
    });

    if (!response.ok) {
      const data = await parseBody(response);
      throw new ApiRequestError(response.status, data?.message ?? '', data?.fields ?? {});
    }

    // O corpo é lido dentro do try: num download o timeout também vale para a transferência
    return isBlob
      ? { blob: await response.blob(), filename: filenameFrom(response) }
      : await parseBody(response);
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    if (signal?.aborted) throw error; // cancelado pelo chamador: quem chamou ignora
    if (timeoutController.signal.aborted) {
      throw new ApiRequestError(0, 'A requisição demorou demais. Tente novamente.');
    }
    throw new ApiRequestError(0, 'Sem conexão com o servidor. Verifique sua rede e tente novamente.');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Wrapper de fetch do portal. Sempre use caminhos relativos ('api/...').
 */
export const api = {
  get:   (path, options) => request(path, { ...options, method: 'GET' }),
  post:  (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put:   (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  /** Baixa um arquivo: resolve com { blob, filename }. Erros viram ApiRequestError como nos demais. */
  download: (path, options) => request(path, { ...options, method: 'GET', responseType: 'blob' }),
};
