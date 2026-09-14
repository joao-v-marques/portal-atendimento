const longDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const ROLE_LABELS = {
  ADMIN: 'Administrador',
  EMPLOYEE: 'Colaborador',
};

/**
 * "Segunda-feira, 14 de setembro de 2026".
 * @param {Date} date
 */
export function formatLongDate(date) {
  const text = longDateFormatter.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Iniciais para avatar: primeira e última palavra ("Maria da Silva" → "MS").
 * @param {string | null | undefined} name
 */
export function getInitials(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words.at(-1).charAt(0) : '';
  return (first + last).toUpperCase();
}

/**
 * Nome do perfil em pt-BR; perfis desconhecidos aparecem como vieram da API.
 * @param {string | null | undefined} role
 */
export function roleLabel(role) {
  return ROLE_LABELS[role] ?? String(role ?? '');
}
