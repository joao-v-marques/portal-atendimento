import { maskPhone, onlyDigits } from '../core/format.js';
import { TRANSACTION_NUMBER_LENGTH } from '../core/validators.js';

// Comportamento dos campos da autorização, usado no Lançar e no modal de edição.

/**
 * Nº da transação é só numérico. Sem maxlength no HTML de propósito: ele cortaria um valor
 * colado com separadores ("1234-5678-9012") antes de os dígitos serem aproveitados.
 * @param {InputEvent} event
 */
function filterTransactionTyping(event) {
  if (!event.inputType?.startsWith('insert') || event.data == null) return; // colar/arrastar: tratado no input
  const input = event.target;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  const room = TRANSACTION_NUMBER_LENGTH - (input.value.length - (end - start));
  const digits = onlyDigits(event.data).slice(0, Math.max(0, room));
  if (digits === event.data) return; // só dígitos e cabe: o navegador insere normalmente

  // Texto com letras (ou que passa de 12): insere só os dígitos que cabem.
  // Não recusar tudo: autocorretor/voz inserem blocos inteiros e os números se perderiam.
  event.preventDefault();
  if (!digits) return;
  input.setRangeText(digits, start, end, 'end');
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Rede de segurança para colar, arrastar e autocompletar: mantém só dígitos e o cursor no lugar.
 * @param {HTMLInputElement} input
 */
export function sanitizeTransactionNumber(input) {
  const caret = input.selectionStart ?? input.value.length;
  const digitsBeforeCaret = onlyDigits(input.value.slice(0, caret)).length;

  const digits = onlyDigits(input.value).slice(0, TRANSACTION_NUMBER_LENGTH);
  if (digits === input.value) return;
  input.value = digits;
  const position = Math.min(digitsBeforeCaret, digits.length);
  input.setSelectionRange(position, position);
}

/**
 * Reaplica a máscara mantendo o cursor depois do mesmo dígito (editar no meio não joga o cursor para o fim).
 * @param {HTMLInputElement} input
 */
export function applyPhoneMask(input) {
  const caret = input.selectionStart ?? input.value.length;
  const digitsBeforeCaret = onlyDigits(input.value.slice(0, caret)).length;

  const masked = maskPhone(input.value);
  if (masked === input.value) return;
  input.value = masked;

  let position = 0;
  let seen = 0;
  while (position < masked.length && seen < digitsBeforeCaret) {
    if (/\d/.test(masked[position])) seen++;
    position++;
  }
  input.setSelectionRange(position, position);
}

/**
 * Liga o filtro de digitação do nº da transação. A limpeza no input continua com quem
 * escuta o formulário (sanitizeTransactionNumber), junto com o contador.
 * @param {HTMLInputElement} input
 */
export function bindTransactionNumberInput(input) {
  input.addEventListener('beforeinput', filterTransactionTyping);
}

/**
 * Contador "n/12" do nº da transação. Leitor de tela só é avisado perto do limite.
 * @param {HTMLElement} counter
 * @param {HTMLInputElement} input
 */
export function updateTransactionCounter(counter, input) {
  const length = input.value.length;
  counter.textContent = `${length}/${TRANSACTION_NUMBER_LENGTH}`;
  counter.setAttribute('aria-live', length >= 10 ? 'polite' : 'off');
}
