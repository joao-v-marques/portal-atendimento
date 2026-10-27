import { api } from '../core/api.js';
import { handleError } from '../core/errors.js';
import { clearFieldError, clearFieldErrors, setFieldError, setSubmitting, showFieldErrors } from '../core/form.js';
import { notify } from '../core/notify.js';
import { ROLE_CODE_MAX, validateRole, validateRoleField } from '../core/validators.js';
import { initDialog } from './dialog.js';

const FIELD_NAMES = ['label', 'name'];

const CODE_HINT_CREATE = 'Gerado a partir do nome. Letras maiúsculas, números e _. Não muda depois de criado.';
const CODE_HINT_EDIT = 'O código não muda depois de criado: as permissões do sistema dependem dele.';

/**
 * "Colaborador do Financeiro" → "COLABORADOR_DO_FINANCEIRO".
 * Sem acento, só A-Z/0-9/_, e começando por letra (como pede o @Pattern do backend).
 * @param {string} label
 */
export function toRoleCode(label) {
  return String(label ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^[^A-Z]+/, '')
    .replace(/_+$/, '')
    .slice(0, ROLE_CODE_MAX)
    .replace(/_+$/, '');
}

/**
 * Diálogo de criar/editar função. Mesmo desenho do user-dialog.js.
 *
 * Na criação o código acompanha o nome digitado até a pessoa editar o código à mão;
 * na edição ele fica somente leitura (o PUT só aceita o nome).
 *
 * @param {HTMLDialogElement} dialogEl
 * @param {{ onSaved: (role: object, mode: 'create' | 'edit') => void }} callbacks
 */
export function initRoleDialog(dialogEl, { onSaved }) {
  const form = dialogEl.querySelector('.js-role-form');
  const title = dialogEl.querySelector('.js-role-dialog-title');
  const submitButton = dialogEl.querySelector('.js-role-submit');
  const codeHint = dialogEl.querySelector('.js-role-code-hint');
  const codeRequired = dialogEl.querySelector('.js-role-code-required');
  const createNote = dialogEl.querySelector('.js-role-create-note');
  const labelField = form.elements.namedItem('label');
  const codeField = form.elements.namedItem('name');

  let mode = 'create';
  let current = null;
  // Enquanto false, o código é sugerido a partir do nome a cada tecla
  let codeEditedByHand = false;

  // Clique fora não fecha: perderia a digitação sem confirmação (mesma regra do user-dialog.js)
  const dialog = initDialog(dialogEl, {
    closeOnBackdrop: false,
    dismissSelector: '.js-role-dismiss',
    onClose() {
      current = null;
    },
  });

  /** O PUT só aceita o nome: o código vai apenas na criação */
  function readPayload() {
    const payload = { label: String(labelField.value).trim() };
    if (mode === 'create') payload.name = String(codeField.value).trim();
    return payload;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (form.hasAttribute('aria-busy')) return; // bloqueia envio duplo

    clearFieldErrors(form);

    const payload = readPayload();
    const errors = validateRole(payload);

    if (Object.keys(errors).length > 0) {
      showFieldErrors(form, errors);
      notify.error('Revise os campos destacados.');
      return;
    }

    setSubmitting(form, true);
    try {
      const saved = mode === 'create'
        ? await api.post('api/user-roles', payload)
        : await api.put(`api/user-roles/${current.id}`, payload);

      const savedMode = mode;
      dialog.close();
      notify.success(`Função ${saved.label} ${savedMode === 'create' ? 'criada' : 'atualizada'}.`);
      onSaved(saved, savedMode);
    } catch (error) {
      // Mantém o diálogo aberto e o que foi digitado
      handleError(error, { form });
    } finally {
      setSubmitting(form, false);
    }
  }

  form.addEventListener('submit', handleSubmit);

  form.addEventListener('blur', (event) => {
    const target = event.target;
    if (!FIELD_NAMES.includes(target.name) || !target.value || target.readOnly) return;
    const message = validateRoleField(target.name, target.value);
    if (message) setFieldError(target, message);
  }, true);

  form.addEventListener('input', (event) => {
    const target = event.target;
    if (!FIELD_NAMES.includes(target.name)) return;

    if (mode === 'create' && target === labelField && !codeEditedByHand) {
      codeField.value = toRoleCode(labelField.value);
      if (codeField.getAttribute('aria-invalid') === 'true' && !validateRoleField('name', codeField.value)) {
        clearFieldError(codeField);
      }
    }

    if (target === codeField) {
      // Maiúsculas enquanto digita, sem mover o cursor; apagar tudo volta à sugestão automática
      const { selectionStart, selectionEnd } = codeField;
      codeField.value = codeField.value.toUpperCase().replace(/\s/g, '_');
      codeField.setSelectionRange(selectionStart, selectionEnd);
      codeEditedByHand = codeField.value !== '';
    }

    if (target.getAttribute('aria-invalid') !== 'true') return;
    if (!validateRoleField(target.name, target.value)) clearFieldError(target);
  });

  return {
    /**
     * @param {{ role?: object | null, opener?: HTMLElement | null }} options
     * role ausente = modo criar
     */
    open({ role = null, opener = null } = {}) {
      mode = role ? 'edit' : 'create';
      current = role;
      codeEditedByHand = false;

      // reset() antes de atribuir: ele volta aos defaults do HTML
      form.reset();
      clearFieldErrors(form);

      title.textContent = mode === 'create' ? 'Nova função' : 'Editar função';
      submitButton.textContent = mode === 'create' ? 'Criar função' : 'Salvar alterações';

      codeField.readOnly = mode === 'edit';
      codeField.required = mode === 'create';
      codeRequired.hidden = mode === 'edit';
      codeHint.textContent = mode === 'create' ? CODE_HINT_CREATE : CODE_HINT_EDIT;
      createNote.hidden = mode === 'edit';

      if (mode === 'edit') {
        labelField.value = role.label ?? '';
        codeField.value = role.name ?? '';
      }

      dialog.open(opener);
      labelField.focus();
    },
  };
}
