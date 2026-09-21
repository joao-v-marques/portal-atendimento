import { api } from '../core/api.js';
import { handleError } from '../core/errors.js';
import { clearFieldError, clearFieldErrors, setFieldError, setSubmitting, showFieldErrors } from '../core/form.js';
import { notify } from '../core/notify.js';
import { validateUser, validateUserField } from '../core/validators.js';
import { initDialog } from './dialog.js';
import { initPasswordField } from './password-field.js';

const FIELD_NAMES = ['password', 'passwordConfirm'];

/**
 * Diálogo de redefinir senha (ação de administrador; não existe troca pelo próprio usuário).
 *
 * Os ids dos campos são namespaced (`senha-*`) porque o form.js localiza a mensagem de
 * erro por `document.getElementById(`${field.id}-error`)` — busca global. Ids repetidos
 * entre os dois diálogos escreveriam o erro no <p> do diálogo errado.
 *
 * @param {HTMLDialogElement} dialogEl
 * @param {{ onDone?: () => void }} [callbacks]
 */
export function initUserPasswordDialog(dialogEl, { onDone } = {}) {
  const form = dialogEl.querySelector('.js-password-form');
  const userLabel = dialogEl.querySelector('.js-password-user');
  const passwordField = form.elements.namedItem('password');

  const passwordControl = initPasswordField(
    passwordField,
    dialogEl.querySelector('.js-password-toggle'),
    dialogEl.querySelector('.js-password-caps-lock'),
  );

  let current = null;

  const dialog = initDialog(dialogEl, {
    closeOnBackdrop: false,
    dismissSelector: '.js-password-dismiss',
    onClose() {
      current = null;
      form.reset();
      clearFieldErrors(form);
    },
  });

  function readValues() {
    return {
      password: passwordField.value,
      passwordConfirm: form.elements.namedItem('passwordConfirm').value,
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (form.hasAttribute('aria-busy') || !current) return;

    clearFieldErrors(form);

    const values = readValues();
    const errors = validateUser(values);

    if (Object.keys(errors).length > 0) {
      showFieldErrors(form, errors);
      notify.error('Revise os campos destacados.');
      return;
    }

    const user = current;
    setSubmitting(form, true);
    try {
      // passwordConfirm é só do cliente: o DTO tem um campo
      await api.patch(`api/users/${user.id}/password`, { password: values.password });
      dialog.close();
      notify.success(`Senha de ${user.name?.trim() || user.username} redefinida.`);
      onDone?.();
    } catch (error) {
      handleError(error, { form });
    } finally {
      setSubmitting(form, false);
    }
  }

  form.addEventListener('submit', handleSubmit);

  form.addEventListener('blur', (event) => {
    const target = event.target;
    if (!FIELD_NAMES.includes(target.name) || !target.value) return;
    const message = validateUserField(target.name, target.value, readValues());
    if (message) setFieldError(target, message);
  }, true);

  form.addEventListener('input', (event) => {
    const target = event.target;
    if (!FIELD_NAMES.includes(target.name)) return;
    if (target.getAttribute('aria-invalid') !== 'true') return;
    if (!validateUserField(target.name, target.value, readValues())) clearFieldError(target);
  });

  return {
    /**
     * @param {{ user: object, opener?: HTMLElement | null }} options
     */
    open({ user, opener = null }) {
      if (!user) return;
      current = user;
      form.reset();
      clearFieldErrors(form);
      passwordControl.reset();
      userLabel.textContent = user.name?.trim() || user.username;
      dialog.open(opener);
      passwordField.focus();
    },
  };
}
