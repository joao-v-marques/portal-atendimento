import { initAppShell } from '../components/app-shell.js';
import { FINISHED_STATUS_ID } from '../components/service-request-table.js';
import { api } from '../core/api.js';
import { getCurrentUser } from '../core/auth.js';
import { el } from '../core/dom.js';
import { handleError } from '../core/errors.js';
import { clearFieldError, clearFieldErrors, setFieldError, setSubmitting, showFieldErrors } from '../core/form.js';
import { maskPhone, onlyDigits } from '../core/format.js';
import { notify } from '../core/notify.js';
import { todayIso, validateServiceRequest, validateServiceRequestField } from '../core/validators.js';

// Status de sistema "Em andamento" (seed da V7, igual ao STATUS_IN_PROGRESS_ID do ServiceRequestService)
const IN_PROGRESS_STATUS_ID = 1;

const form = document.querySelector('.js-service-request-form');
const fields = {
  protocolNumber: form.elements.namedItem('protocolNumber'),
  openedAt: form.elements.namedItem('openedAt'),
  categoryId: form.elements.namedItem('categoryId'),
  channelId: form.elements.namedItem('channelId'),
  typeId: form.elements.namedItem('typeId'),
  severityId: form.elements.namedItem('severityId'),
  statusId: form.elements.namedItem('statusId'),
  assignedToId: form.elements.namedItem('assignedToId'),
  requesterName: form.elements.namedItem('requesterName'),
  requesterCardNumber: form.elements.namedItem('requesterCardNumber'),
  requesterCpf: form.elements.namedItem('requesterCpf'),
  requesterBirthDate: form.elements.namedItem('requesterBirthDate'),
  requesterPhone: form.elements.namedItem('requesterPhone'),
  requesterEmail: form.elements.namedItem('requesterEmail'),
  description: form.elements.namedItem('description'),
};
const submitButton = form.querySelector('[type="submit"]');
const submitStatus = document.querySelector('.js-submit-status');

// Selects carregados da API: placeholder e se o campo é obrigatório para registrar
const SELECTS = {
  categoryId: { placeholder: 'Selecione a categoria', required: true },
  channelId: { placeholder: 'Selecione o canal', required: true },
  typeId: { placeholder: 'Selecione o tipo', required: true },
  severityId: { placeholder: 'Sem severidade', required: false },
  statusId: { placeholder: 'Selecione o status', required: true },
  assignedToId: { placeholder: 'Selecione o responsável', required: true },
};

let options = { categoryId: [], channelId: [], typeId: [], severityId: [], statusId: [], assignedToId: [] };
let currentUsername = null;
let isDirty = false;

// ── Selects ──────────────────────────────────────────────────

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

// Só cadastros ativos podem ser usados num registro (o backend recusa inativos)
function activeSorted(items) {
  return items
    .filter((item) => item.isActive ?? true)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

async function loadOptions() {
  // allSettled: um cadastro que falhar não impede os outros de carregar
  const [categories, channels, types, severities, statuses, assignees, user] = await Promise.allSettled([
    api.get('api/service-request-categories'),
    api.get('api/service-request-channels'),
    api.get('api/service-request-types'),
    api.get('api/service-request-severities'),
    api.get('api/service-request-status'),
    api.get('api/service-requests/assignees'),
    getCurrentUser(),
  ]);

  const loaded = {
    categoryId: categories,
    channelId: channels,
    typeId: types,
    severityId: severities,
    // Finalizado fica de fora: o POST recusa, a finalização tem fluxo próprio (com resolução)
    statusId: statuses.status === 'fulfilled'
      ? { status: 'fulfilled', value: statuses.value.filter((status) => status.id !== FINISHED_STATUS_ID) }
      : statuses,
    // Responsáveis já vêm só ativos e ordenados pelo backend
    assignedToId: assignees.status === 'fulfilled'
      ? { status: 'fulfilled', value: assignees.value.map((assignee) => ({ ...assignee, name: assignee.name || assignee.username })) }
      : assignees,
  };

  let missingRequired = false;
  let firstError = null;
  for (const [name, result] of Object.entries(loaded)) {
    if (result.status === 'fulfilled') {
      options[name] = name === 'assignedToId' ? result.value : activeSorted(result.value);
      fillSelect(fields[name], options[name], SELECTS[name].placeholder);
    } else {
      options[name] = [];
      markSelectUnavailable(fields[name]);
      if (SELECTS[name].required) missingRequired = true;
      firstError ??= result.reason;
    }
  }

  currentUsername = user.status === 'fulfilled' ? user.value.username : null;
  applyDefaults();

  // Sem um select obrigatório o registro não passa no backend
  submitButton.disabled = missingRequired;
  if (firstError) handleError(firstError);
}

// ── Valores padrão ───────────────────────────────────────────

function applyDefaults() {
  fields.requesterBirthDate.max = todayIso();

  // Pré-seleciona quando só existe uma opção
  ['categoryId', 'channelId', 'typeId'].forEach((name) => {
    if (options[name].length === 1) fields[name].value = String(options[name][0].id);
  });

  if (options.statusId.some((status) => status.id === IN_PROGRESS_STATUS_ID)) {
    fields.statusId.value = String(IN_PROGRESS_STATUS_ID);
  }

  // Colaborador do relacionamento já vem como responsável; o ADMIN não aparece na lista e escolhe
  const self = options.assignedToId.find((assignee) => assignee.username === currentUsername);
  if (self) fields.assignedToId.value = String(self.id);
}

// Data de abertura não pode ser futura: o limite acompanha o relógio a cada foco
function syncOpenedAtMax() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  fields.openedAt.max = now.toISOString().slice(0, 16);
}

// ── Máscaras ─────────────────────────────────────────────────

// Mantém só dígitos e o cursor no lugar (colar "123.456.789-01" vira "12345678901")
function keepDigits(input) {
  const caret = input.selectionStart ?? input.value.length;
  const digitsBeforeCaret = onlyDigits(input.value.slice(0, caret)).length;

  const digits = onlyDigits(input.value);
  if (digits === input.value) return;
  input.value = digits;
  input.setSelectionRange(digitsBeforeCaret, digitsBeforeCaret);
}

// Reaplica a máscara mantendo o cursor depois do mesmo dígito
function applyPhoneMask() {
  const input = fields.requesterPhone;
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

// ── Validação ────────────────────────────────────────────────

function readValues() {
  return Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, String(field.value)]));
}

function handleBlur(event) {
  const field = event.target;
  if (!(field.name in fields) || !field.value) return; // só valida o que a pessoa já preencheu
  const message = validateServiceRequestField(field.name, field.value);
  if (message) setFieldError(field, message);
}

function handleEdit(event) {
  const field = event.target;
  if (!(field.name in fields)) return;
  isDirty = true;
  if (event.type === 'input') {
    if (field === fields.requesterCardNumber || field === fields.requesterCpf) keepDigits(field);
    if (field === fields.requesterPhone) applyPhoneMask();
  }
  // Enquanto digita, só remove o erro quando o valor fica válido; nunca mostra erro novo
  if (field.getAttribute('aria-invalid') === 'true' && !validateServiceRequestField(field.name, field.value)) {
    clearFieldError(field);
  }
}

// ── Envio ────────────────────────────────────────────────────

// Corpo no formato do ServiceRequestRequest: ids numéricos e opcionais vazios como null
function toRequestBody(values) {
  return {
    protocolNumber: values.protocolNumber.trim(),
    categoryId: Number(values.categoryId),
    channelId: Number(values.channelId),
    typeId: Number(values.typeId),
    severityId: values.severityId ? Number(values.severityId) : null,
    statusId: Number(values.statusId),
    assignedToId: Number(values.assignedToId),
    requesterCardNumber: values.requesterCardNumber.trim(),
    requesterName: values.requesterName.trim(),
    requesterCpf: values.requesterCpf.trim() || null,
    requesterBirthDate: values.requesterBirthDate || null,
    requesterPhone: onlyDigits(values.requesterPhone) || null, // a máscara é só visual
    requesterEmail: values.requesterEmail.trim() || null,
    description: values.description.trim(),
    // Em branco o backend usa a data e a hora do registro
    openedAt: values.openedAt ? new Date(values.openedAt).toISOString() : null,
  };
}

function setBusy(isBusy) {
  setSubmitting(form, isBusy);
  submitStatus.textContent = isBusy ? 'Registrando atendimento…' : '';
}

function resetForNextRegistration() {
  form.reset();
  clearFieldErrors(form);
  applyDefaults();
  isDirty = false;
  fields.protocolNumber.focus();
}

async function handleSubmit(event) {
  event.preventDefault();
  if (form.hasAttribute('aria-busy')) return; // bloqueia envio duplo

  clearFieldErrors(form);
  const values = readValues();
  const errors = validateServiceRequest(values);
  if (Object.keys(errors).length > 0) {
    showFieldErrors(form, errors);
    notify.error('Revise os campos destacados.');
    return;
  }

  setBusy(true);
  try {
    const created = await api.post('api/service-requests', toRequestBody(values));
    notify.success(`Atendimento ${created.protocolNumber} registrado.`);
    setBusy(false);
    resetForNextRegistration();
  } catch (error) {
    setBusy(false);
    handleError(error, { form }); // mantém tudo o que foi preenchido
    // No POST, o único 409 é o protocolo repetido (ConflictException do ServiceRequestService)
    if (error?.status === 409) {
      setFieldError(fields.protocolNumber, 'Este número de protocolo já foi registrado');
      fields.protocolNumber.focus();
    }
  }
}

// ── Inicialização ────────────────────────────────────────────

initAppShell().catch(() => {}); // erros do usuário logado já são tratados no shell

form.addEventListener('focusout', handleBlur);
form.addEventListener('input', handleEdit);
form.addEventListener('change', handleEdit);
form.addEventListener('submit', handleSubmit);
fields.openedAt.addEventListener('focus', syncOpenedAtMax);

// Aviso nativo ao sair com dados não salvos (inclusive pelo "Cancelar")
window.addEventListener('beforeunload', (event) => {
  if (!isDirty || form.hasAttribute('aria-busy')) return;
  event.preventDefault();
  event.returnValue = '';
});

submitButton.disabled = true; // habilita quando os cadastros carregarem
syncOpenedAtMax();
loadOptions();
