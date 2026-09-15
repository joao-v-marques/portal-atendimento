const longDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR');
const timeFormatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

const STATUS_VARIANTS = {
  'em análise': 'analysis',
  'finalizado': 'done',
};

const FILE_TYPE_LABELS = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
};

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

export const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '');

/**
 * "(11) 91234-5678" / "(11) 1234-5678". Números fora do padrão aparecem só com dígitos.
 * @param {string | null | undefined} value
 */
export function formatPhone(value) {
  const d = onlyDigits(value);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d || '—';
}

/**
 * Máscara progressiva para digitação: "(11", "(11) 9123", "(11) 91234-5678".
 * Só visual: o valor enviado à API é onlyDigits().
 * @param {string | null | undefined} value
 */
export function maskPhone(value) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * "2026-09-14" (LocalDate) → "14/09/2026".
 * Não usar new Date(iso) direto: vira UTC e pode voltar um dia.
 * @param {string | null | undefined} isoDate
 */
export function formatDate(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-').map(Number);
  return dateFormatter.format(new Date(y, m - 1, d));
}

/**
 * OffsetDateTime → "14/09/2026 às 15:30" (no fuso do navegador).
 * @param {string | null | undefined} iso
 */
export function formatDateTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  return `${dateFormatter.format(date)} às ${timeFormatter.format(date)}`;
}

/**
 * Bytes → "820 KB" / "1,2 MB".
 * @param {number} bytes
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Variante visual do badge de status; status desconhecido fica neutro.
 * @param {string | null | undefined} statusName
 */
export function statusVariant(statusName) {
  return STATUS_VARIANTS[String(statusName ?? '').trim().toLowerCase()] ?? 'neutral';
}

/**
 * "application/pdf" → "PDF".
 * @param {string | null | undefined} contentType
 */
export function fileTypeLabel(contentType) {
  return FILE_TYPE_LABELS[contentType] ?? 'Arquivo';
}
