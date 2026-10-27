import { api } from '../core/api.js';
import { el } from '../core/dom.js';
import { handleError } from '../core/errors.js';
import { clearFieldError, clearFieldErrors, setFieldError, setSubmitting, showFieldErrors } from '../core/form.js';
import { roleLabel } from '../core/format.js';
import { notify } from '../core/notify.js';
import { validateUser, validateUserField } from '../core/validators.js';
import { initDialog } from './dialog.js';
import { initPasswordField } from './password-field.js';
import { userRoleId } from './users-table.js';

const FIELD_NAMES = ['username', 'name', 'email', 'roleId', 'password'];

/**
 * Preenche o select de perfis com id no value (o DTO espera o id, não o nome).
 * Mantém o perfil atual do usuário na lista mesmo se ele estiver inativo, para não
 * desaparecer da tela ao editar.
 * @param {HTMLSelectElement} select
 * @param {{ id: number, name: string, label?: string, active?: boolean, isActive?: boolean }[]} roles
 * @param {number | null} selectedId
 */
function fillRoleOptions(select, roles, selectedId) {
  const isActive = (role) => role.active ?? role.isActive ?? true;
  const available = roles.filter((role) => isActive(role) || role.id === selectedId);

  const options = available.map((role) => el('option', {
    text: roleLabel(role),
    attrs: { value: String(role.id) },
  }));

  select.replaceChildren(el('option', { text: 'Selecione', attrs: { value: '' } }), ...options);
  select.value = selectedId === null ? '' : String(selectedId);
  select.disabled = false;
}

/**
 * Diálogo de criar/editar usuário. Um único <dialog> para os dois modos: um conjunto
 * de ids, sem duplicação (o form.js acha a mensagem de erro por `${field.id}-error`,
 * numa busca global no documento).
 *
 * @param {HTMLDialogElement} dialogEl
 * @param {{ onSaved: (user: object, mode: 'create' | 'edit') => void, onResetPassword: (user: object) => void }} callbacks
 */
export function initUserDialog(dialogEl, { onSaved, onResetPassword }) {
  const form = dialogEl.querySelector('.js-user-form');
  const title = dialogEl.querySelector('.js-user-dialog-title');
  const submitButton = dialogEl.querySelector('.js-user-submit');
  const passwordFieldWrapper = dialogEl.querySelector('.js-user-password-field');
  const resetPasswordButton = dialogEl.querySelector('.js-user-reset-password');
  const roleSelect = form.elements.namedItem('roleId');
  const passwordField = form.elements.namedItem('password');

  const passwordControl = initPasswordField(
    passwordField,
    dialogEl.querySelector('.js-user-password-toggle'),
    dialogEl.querySelector('.js-user-caps-lock'),
  );

  let mode = 'create';
  let current = null;
  let roles = [];
  let isDirty = false;

  // Clique fora não fecha: perderia a digitação sem confirmação, e um segundo modal
  // para "descartar alterações?" é proibido pelo guia 11.7
  const dialog = initDialog(dialogEl, {
    closeOnBackdrop: false,
    dismissSelector: '.js-user-dismiss',
    onClose() {
      current = null;
      isDirty = false;
    },
  });

  function field(name) {
    return form.elements.namedItem(name);
  }

  /** O payload muda por modo: o PUT não aceita senha, o POST exige */
  function readPayload() {
    const payload = {
      username: String(field('username').value).trim(),
      name: String(field('name').value).trim(),
      email: String(field('email').value).trim(),
      roleId: field('roleId').value,
    };

    if (mode === 'create') payload.password = passwordField.value;

    return payload;
  }

  function toRequestBody(payload) {
    const body = {
      username: payload.username,
      name: payload.name,
      email: payload.email,
      roleId: Number(payload.roleId),
    };

    if (mode === 'create') body.password = payload.password;

    return body;
  }

  function syncDirtyState() {
    isDirty = true;
    // Redefinir senha fecha este diálogo; com o formulário sujo isso descartaria a digitação em silêncio
    if (mode === 'edit') {
      resetPasswordButton.disabled = true;
      resetPasswordButton.title = 'Salve ou descarte as alterações antes de redefinir a senha.';
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (form.hasAttribute('aria-busy')) return; // bloqueia envio duplo

    clearFieldErrors(form);

    const payload = readPayload();
    const errors = validateUser(payload);

    if (Object.keys(errors).length > 0) {
      showFieldErrors(form, errors);
      notify.error('Revise os campos destacados.');
      return;
    }

    setSubmitting(form, true);
    try {
      const body = toRequestBody(payload);
      const saved = mode === 'create'
        ? await api.post('api/users', body)
        : await api.put(`api/users/${current.id}`, body);

      const savedMode = mode;
      dialog.close();
      notify.success(`Usuário ${saved.username} ${savedMode === 'create' ? 'criado' : 'atualizado'}.`);
      onSaved(saved, savedMode);
    } catch (error) {
      // Mantém o diálogo aberto e o que foi digitado (guia 14.7)
      handleError(error, { form });
    } finally {
      setSubmitting(form, false);
    }
  }

  form.addEventListener('submit', handleSubmit);

  // Erro aparece ao sair do campo (só se digitou algo) e é limpo assim que o valor fica válido
  form.addEventListener('blur', (event) => {
    const target = event.target;
    if (!FIELD_NAMES.includes(target.name) || !target.value) return;
    const message = validateUserField(target.name, target.value, readPayload());
    if (message) setFieldError(target, message);
  }, true);

  form.addEventListener('input', (event) => {
    const target = event.target;
    if (!FIELD_NAMES.includes(target.name)) return;
    syncDirtyState();
    if (target.getAttribute('aria-invalid') !== 'true') return;
    if (!validateUserField(target.name, target.value, readPayload())) clearFieldError(target);
  });

  form.addEventListener('change', (event) => {
    if (FIELD_NAMES.includes(event.target.name)) syncDirtyState();
  });

  resetPasswordButton.addEventListener('click', () => {
    const user = current;
    if (!user) return;
    // Em sequência, nunca empilhado (guia 11.7): fecha este e abre o de senha no mesmo passo
    dialog.close();
    onResetPassword(user);
  });

  return {
    /** Perfis carregados uma vez pela página e reaproveitados a cada abertura */
    setRoles(loadedRoles) {
      roles = loadedRoles ?? [];
    },

    /**
     * @param {{ user?: object | null, opener?: HTMLElement | null }} options
     * user ausente = modo criar
     */
    open({ user = null, opener = null } = {}) {
      mode = user ? 'edit' : 'create';
      current = user;

      // reset() antes de atribuir: ele volta aos defaults do HTML, então preencher antes não funciona
      form.reset();
      clearFieldErrors(form);
      passwordControl.reset();
      isDirty = false;

      title.textContent = mode === 'create' ? 'Novo usuário' : 'Editar usuário';
      submitButton.textContent = mode === 'create' ? 'Criar usuário' : 'Salvar alterações';

      // Senha só na criação: o UserUpdateRequest não tem o campo.
      // disabled além de hidden — campo desabilitado não entra no FormData nem na validação
      passwordFieldWrapper.hidden = mode === 'edit';
      passwordField.disabled = mode === 'edit';

      resetPasswordButton.hidden = mode === 'create';
      resetPasswordButton.disabled = false;
      resetPasswordButton.removeAttribute('title');

      if (mode === 'edit') {
        field('username').value = user.username ?? '';
        field('name').value = user.name ?? '';
        field('email').value = user.email ?? '';
      }

      fillRoleOptions(roleSelect, roles, mode === 'edit' ? userRoleId(user) : null);

      dialog.open(opener);
      field('username').focus();
    },
  };
}
