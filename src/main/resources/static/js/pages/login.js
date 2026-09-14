import { api } from '../core/api.js';
import { notify } from '../core/notify.js';
import { handleError } from '../core/errors.js';
import { clearFieldError, clearFieldErrors, setFieldError, setSubmitting } from '../core/form.js';
import { showLoginReasonFromUrl } from '../core/auth.js';

const MESSAGES = {
  usernameRequired: 'Informe o usuário.',
  passwordRequired: 'Informe a senha.',
  reviewFields: 'Revise os campos destacados.',
  invalidCredentials: 'Usuário ou senha inválidos.',
  capsLockOn: 'Caps Lock está ativado.',
};

const form = document.querySelector('.js-login-form');
const usernameField = form.elements.namedItem('username');
const passwordField = form.elements.namedItem('password');
const togglePasswordButton = form.querySelector('.js-toggle-password');
const capsLockHint = form.querySelector('.js-capslock-hint');

// ── Validação ────────────────────────────────────────────────

// Mesmas regras e mensagens do AuthRequest (@NotBlank)
function validateField(field) {
  if (field === usernameField && !field.value.trim()) return MESSAGES.usernameRequired;
  if (field === passwordField && !field.value) return MESSAGES.passwordRequired;
  return null;
}

function handleFieldBlur(event) {
  const field = event.currentTarget;
  if (!field.value) return; // só valida no blur se a pessoa já digitou algo
  const message = validateField(field);
  if (message) setFieldError(field, message);
}

function handleFieldInput(event) {
  const field = event.currentTarget;
  if (field.getAttribute('aria-invalid') === 'true' && !validateField(field)) {
    clearFieldError(field);
  }
}

function validateForm() {
  let firstInvalid = null;
  for (const field of [usernameField, passwordField]) {
    const message = validateField(field);
    if (!message) continue;
    setFieldError(field, message);
    firstInvalid ??= field;
  }
  firstInvalid?.focus();
  return firstInvalid === null;
}

// ── Envio ────────────────────────────────────────────────────

function isInvalidCredentials(error) {
  if (error?.status === 401) return true;
  return error?.status === 400 && Object.keys(error.fields ?? {}).length === 0;
}

function resetPasswordAfterFailure() {
  passwordField.value = '';
  setPasswordVisible(false);
  updateCapsLockHint(false);
  passwordField.focus();
}

async function handleSubmit(event) {
  event.preventDefault();
  if (form.hasAttribute('aria-busy')) return; // bloqueia envio duplo

  clearFieldErrors(form);
  if (!validateForm()) {
    notify.error(MESSAGES.reviewFields);
    return;
  }

  setSubmitting(form, true);
  try {
    await api.post('api/auth/login', {
      username: usernameField.value.trim(),
      password: passwordField.value,
    });
    // O token fica no cookie HttpOnly; a navegação é o feedback de sucesso
    window.location.assign('home');
  } catch (error) {
    setSubmitting(form, false);
    // Nunca dizer qual dos dois está errado
    if (isInvalidCredentials(error)) {
      notify.error(MESSAGES.invalidCredentials);
      resetPasswordAfterFailure();
      return;
    }
    handleError(error, { form, redirectOn401: false });
  }
}

// ── Mostrar senha ────────────────────────────────────────────

function setPasswordVisible(isVisible) {
  passwordField.type = isVisible ? 'text' : 'password';
  togglePasswordButton.setAttribute('aria-pressed', String(isVisible));
}

function handleTogglePassword() {
  const isVisible = togglePasswordButton.getAttribute('aria-pressed') !== 'true';
  setPasswordVisible(isVisible);
  passwordField.focus();
}

// ── Caps Lock ────────────────────────────────────────────────

function updateCapsLockHint(isOn) {
  const text = isOn ? MESSAGES.capsLockOn : '';
  // Só escreve quando muda, para o leitor de tela não repetir o aviso a cada tecla
  if (capsLockHint.textContent !== text) capsLockHint.textContent = text;
}

function handleCapsLockKey(event) {
  if (typeof event.getModifierState !== 'function') return;
  updateCapsLockHint(event.getModifierState('CapsLock'));
}

// ── Inicialização ────────────────────────────────────────────

showLoginReasonFromUrl();

form.addEventListener('submit', handleSubmit);

for (const field of [usernameField, passwordField]) {
  field.addEventListener('blur', handleFieldBlur);
  field.addEventListener('input', handleFieldInput);
}

togglePasswordButton.addEventListener('click', handleTogglePassword);

passwordField.addEventListener('keydown', handleCapsLockKey);
passwordField.addEventListener('keyup', handleCapsLockKey);
passwordField.addEventListener('blur', () => updateCapsLockHint(false));
