import { initAppShell } from '../components/app-shell.js';
import { deadlineLimitText } from '../components/authorization-table.js';
import { initProcedureCombobox } from '../components/procedure-combobox.js';
import { initFileUpload } from '../components/file-upload.js';
import { api } from '../core/api.js';
import { el } from '../core/dom.js';
import { handleError } from '../core/errors.js';
import { clearFieldError, clearFieldErrors, setFieldError, setSubmitting, showFieldErrors } from '../core/form.js';
import { maskPhone, onlyDigits } from '../core/format.js';
import { notify } from '../core/notify.js';
import {
  TRANSACTION_NUMBER_LENGTH,
  todayIso,
  validateAuthorizationField,
  validateAuthorizationRequest,
} from '../core/validators.js';

// O backend responde duplicado como regra de negócio (400 sem "fields"); comparamos o texto
// para também destacar o campo. Se a mensagem mudar no AuthorizationRequestService, atualize aqui.
const DUPLICATE_TRANSACTION_MESSAGE = 'Já existe uma autorização com este número de transação.';
const DEFAULT_STATUS_NAME = 'em análise';
const COUNTER_ANNOUNCE_FROM = 10;

const form = document.querySelector('.js-authorization-form');
const fields = {
  transactionNumber: form.elements.namedItem('transactionNumber'),
  requestDate: form.elements.namedItem('requestDate'),
  authorizationTypeId: form.elements.namedItem('authorizationTypeId'),
  authorizationStatusId: form.elements.namedItem('authorizationStatusId'),
  beneficiaryName: form.elements.namedItem('beneficiaryName'),
  beneficiaryPhone: form.elements.namedItem('beneficiaryPhone'),
};
const counter = document.querySelector('.js-transaction-counter');
const typeDeadline = document.querySelector('.js-type-deadline');
const submitButton = form.querySelector('[type="submit"]');
const submitStatus = document.querySelector('.js-submit-status');

let options = { types: [], statuses: [] };
let isDirty = false;

// ── Procedimento (combobox) e status (select) ────────────────

const TYPE_HINT = typeDeadline.textContent;

const procedure = initProcedureCombobox(document.querySelector('.js-procedure-combobox'), {
  onChange(item, { byUser }) {
    if (byUser) isDirty = true;
    updateTypeDeadline();
    if (procedure.selected) clearFieldError(fields.authorizationTypeId);
  },
});

function fillSelect(select, items, placeholder) {
  select.replaceChildren(
    el('option', { text: placeholder, attrs: { value: '' } }),
    ...items.map((item) => el('option', { text: item.name, attrs: { value: String(item.id) } })),
  );
  select.disabled = false;
}

function markSelectUnavailable(select) {
  select.replaceChildren(el('option', { text: 'Não foi possível carregar', attrs: { value: '' } }));
  select.disabled = true;
}

// Só tipos/status ativos podem ser usados num lançamento (o backend recusa inativos)
function activeSorted(items) {
  return items
    .filter((item) => item.isActive)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

async function loadOptions() {
  try {
    const [types, statuses] = await Promise.all([
      api.get('api/authorization-types'),
      api.get('api/authorization-status'),
    ]);
    options = { types: activeSorted(types), statuses: activeSorted(statuses) };
    procedure.setItems(options.types);
    fillSelect(fields.authorizationStatusId, options.statuses, 'Selecione o status');
    applyDefaults();
    submitButton.disabled = false;
  } catch (error) {
    procedure.setUnavailable();
    markSelectUnavailable(fields.authorizationStatusId);
    submitButton.disabled = true; // sem tipo e status o cadastro não passa no backend
    handleError(error);
  }
}

// ── Valores padrão (§12.4) ───────────────────────────────────

function applyDefaults() {
  fields.requestDate.value = todayIso();

  // Procedimento: pré-seleciona quando só existe uma opção; status: "Em análise"
  if (options.types.length === 1) procedure.select(options.types[0].id);
  else procedure.clear();
  const defaultStatus = options.statuses.find((status) => status.name.trim().toLowerCase() === DEFAULT_STATUS_NAME);
  if (defaultStatus) fields.authorizationStatusId.value = String(defaultStatus.id);

  updateCounter();
  updateTypeDeadline();
}

// Escolhido: confirma código e prazo da ANS; sem escolha: orienta como buscar
function updateTypeDeadline() {
  const type = procedure.selected;
  typeDeadline.textContent = type
    ? `Código ${type.code}. Prazo da ANS: ${deadlineLimitText(type.maxDays).toLowerCase()}.`
    : TYPE_HINT;
}

// ── Contador e máscara ───────────────────────────────────────

function updateCounter() {
  const length = fields.transactionNumber.value.length;
  counter.textContent = `${length}/${TRANSACTION_NUMBER_LENGTH}`;
  // Leitor de tela só é avisado perto do limite, para não anunciar cada tecla
  counter.setAttribute('aria-live', length >= COUNTER_ANNOUNCE_FROM ? 'polite' : 'off');
}

// Nº da transação é só numérico. Sem maxlength no HTML de propósito: ele cortaria um valor
// colado com separadores ("1234-5678-9012") antes de os dígitos serem aproveitados.
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

// Rede de segurança para colar, arrastar e autocompletar: mantém só dígitos e o cursor no lugar
function sanitizeTransactionNumber() {
  const input = fields.transactionNumber;
  const caret = input.selectionStart ?? input.value.length;
  const digitsBeforeCaret = onlyDigits(input.value.slice(0, caret)).length;

  const digits = onlyDigits(input.value).slice(0, TRANSACTION_NUMBER_LENGTH);
  if (digits === input.value) return;
  input.value = digits;
  const position = Math.min(digitsBeforeCaret, digits.length);
  input.setSelectionRange(position, position);
}

// Reaplica a máscara mantendo o cursor depois do mesmo dígito (editar no meio não joga o cursor para o fim)
function applyPhoneMask() {
  const input = fields.beneficiaryPhone;
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

// ── Validação (§10.2) ────────────────────────────────────────

function readValues() {
  return {
    transactionNumber: fields.transactionNumber.value.trim(),
    requestDate: fields.requestDate.value,
    authorizationTypeId: procedure.selected?.id ?? null,
    authorizationStatusId: Number(fields.authorizationStatusId.value) || null,
    beneficiaryName: fields.beneficiaryName.value.trim(),
    beneficiaryPhone: onlyDigits(fields.beneficiaryPhone.value),
  };
}

function handleBlur(event) {
  const field = event.target;
  if (!(field.name in fields) || !field.value) return; // só valida o que a pessoa já preencheu
  if (field.closest('.js-procedure-combobox')?.contains(event.relatedTarget)) return; // foco ainda no combobox (ex.: limpar)
  const message = validateAuthorizationField(field.name, readValues()[field.name]);
  if (message) setFieldError(field, message);
}

function handleEdit(event) {
  const field = event.target;
  if (!(field.name in fields)) return;
  isDirty = true;
  if (field === fields.transactionNumber) {
    if (event.type === 'input') sanitizeTransactionNumber();
    updateCounter();
  }
  if (field === fields.beneficiaryPhone && event.type === 'input') applyPhoneMask();
  // Enquanto digita, só remove o erro quando o valor fica válido; nunca mostra erro novo
  if (field.getAttribute('aria-invalid') === 'true' && !validateAuthorizationField(field.name, readValues()[field.name])) {
    clearFieldError(field);
  }
}

// ── Envio (§10.5) ────────────────────────────────────────────

function buildBody(payload) {
  const body = new FormData();
  body.append('request', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
  upload.getFiles().forEach((file) => body.append('files', file));
  return body;
}

function setBusy(isBusy) {
  setSubmitting(form, isBusy);
  upload.setDisabled(isBusy);
  submitStatus.textContent = isBusy ? 'Enviando autorização…' : '';
}

function resetForNextLaunch() {
  form.reset();
  upload.clear();
  clearFieldErrors(form);
  applyDefaults();
  isDirty = false;
  fields.transactionNumber.focus();
}

async function handleSubmit(event) {
  event.preventDefault();
  if (form.hasAttribute('aria-busy')) return; // bloqueia envio duplo

  clearFieldErrors(form);
  const payload = readValues();
  const errors = validateAuthorizationRequest(payload);
  if (Object.keys(errors).length > 0) {
    showFieldErrors(form, errors);
    notify.error('Revise os campos destacados.');
    return;
  }

  setBusy(true);
  try {
    const created = await api.post('api/authorization-requests', buildBody(payload));
    notify.success(`Autorização ${created.transactionNumber} lançada.`);
    setBusy(false);
    resetForNextLaunch();
  } catch (error) {
    setBusy(false);
    handleError(error, { form }); // mantém tudo o que foi preenchido
    if (error?.message === DUPLICATE_TRANSACTION_MESSAGE) {
      setFieldError(fields.transactionNumber, 'Este número de transação já foi lançado');
      fields.transactionNumber.focus();
    }
  }
}

// ── Inicialização ────────────────────────────────────────────

initAppShell().catch(() => {}); // erros do usuário logado já são tratados no shell

const upload = initFileUpload(document.querySelector('.js-upload'), {
  onChange(files) {
    if (files.length > 0) isDirty = true;
  },
});

fields.transactionNumber.addEventListener('beforeinput', filterTransactionTyping);
form.addEventListener('focusout', handleBlur);
form.addEventListener('input', handleEdit);
form.addEventListener('change', handleEdit);
form.addEventListener('submit', handleSubmit);

// Aviso nativo ao sair com dados não salvos (inclusive pelo "Cancelar")
window.addEventListener('beforeunload', (event) => {
  if (!isDirty || form.hasAttribute('aria-busy')) return;
  event.preventDefault();
  event.returnValue = '';
});

submitButton.disabled = true; // habilita quando tipos e status carregarem
applyDefaults();
isDirty = false;
loadOptions();
