import { api } from '../core/api.js';
import { logout } from '../core/auth.js';
import { handleError } from '../core/errors.js';
import { clearFieldError, clearFieldErrors, setFieldError, setSubmitting, showFieldErrors } from '../core/form.js';
import { notify } from '../core/notify.js';
import { validateUser, validateUserField } from '../core/validators.js';
import { initDialog } from './dialog.js';
import { initPasswordField } from './password-field.js';

const FIELD_NAMES = ['password', 'passwordConfirm'];

/**
 * Diálogo "Alterar minha senha" do menu do usuário (qualquer perfil).
 * Mesmas regras do user-password-dialog.js (redefinição pelo admin), mas chama
 * api/auth/me/password e, ao salvar, encerra a sessão e volta ao login.
 *
 * Ids namespaced (`minha-senha-*`): na tela de configurações este diálogo convive com o
 * de redefinir senha (`senha-*`), e o form.js acha o erro por id global.
 *
 * @param {HTMLDialogElement} dialogEl
 * @returns {{ open: (opener?: HTMLElement | null) => void }}
 */
export function initOwnPasswordDialog(dialogEl) {
  const form = dialogEl.querySelector('.js-own-password-form');
  const passwordField = form.elements.namedItem('password');

  const passwordControl = initPasswordField(
    passwordField,
    dialogEl.querySelector('.js-own-password-toggle'),
    dialogEl.querySelector('.js-own-password-caps-lock'),
  );

  const dialog = initDialog(dialogEl, {
    closeOnBackdrop: false,
    dismissSelector: '.js-own-password-dismiss',
    onClose() {
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
    if (form.hasAttribute('aria-busy')) return;

    clearFieldErrors(form);

    const values = readValues();
    const errors = validateUser(values);

    if (Object.keys(errors).length > 0) {
      showFieldErrors(form, errors);
      notify.error('Revise os campos destacados.');
      return;
    }

    setSubmitting(form, true);
    try {
      // passwordConfirm é só do cliente: o DTO tem um campo
      await api.patch('api/auth/me/password', { password: values.password });
    } catch (error) {
      setSubmitting(form, false);
      handleError(error, { form });
      return;
    }

    // Senha trocada: o botão segue em carregamento até a navegação. O aviso aparece no login.
    // Se o logout falhar, vai para o login mesmo assim: a senha já mudou
    try {
      await logout('senha-alterada');
    } catch {
      window.location.assign('login?erro=senha-alterada');
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
    open(opener = null) {
      form.reset();
      clearFieldErrors(form);
      passwordControl.reset();
      dialog.open(opener);
      passwordField.focus();
    },
  };
}
