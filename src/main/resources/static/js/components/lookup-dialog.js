import { api } from '../core/api.js';
import { handleError } from '../core/errors.js';
import { clearFieldError, clearFieldErrors, setFieldError, setSubmitting, showFieldErrors } from '../core/form.js';
import { notify } from '../core/notify.js';
import { agree } from './lookup-config.js';
import { initDialog } from './dialog.js';

// Mesmos limites e mensagens dos DTOs (ServiceRequest*Request)
const NAME_MAX = 100;

function validateName(value) {
  const name = String(value ?? '').trim();
  if (!name) return 'Informe o nome';
  if (name.length > NAME_MAX) return `O nome deve ter no máximo ${NAME_MAX} caracteres`;
  return null;
}

function validateLevel(value) {
  if (String(value ?? '').trim() === '') return 'Informe o nível da severidade';
  const level = Number(value);
  if (!Number.isInteger(level) || level <= 0) return 'O nível da severidade deve ser um número inteiro maior que zero';
  if (level > 32767) return 'O nível da severidade deve ser no máximo 32767'; // Short no backend
  return null;
}

/**
 * Diálogo de criar/editar um cadastro auxiliar (nome, e nível na severidade).
 * Um único <dialog> para os 5 cadastros: o título e o campo de nível mudam com o cadastro.
 *
 * @param {HTMLDialogElement} dialogEl
 * @param {{ onSaved: (item: object, mode: 'create' | 'edit') => void }} callbacks
 */
export function initLookupDialog(dialogEl, { onSaved }) {
  const form = dialogEl.querySelector('.js-lookup-form');
  const title = dialogEl.querySelector('.js-lookup-dialog-title');
  const submitButton = dialogEl.querySelector('.js-lookup-submit');
  const levelWrapper = dialogEl.querySelector('.js-lookup-level-field');
  const nameField = form.elements.namedItem('name');
  const levelField = form.elements.namedItem('level');

  let lookup = null;
  let current = null;

  // Clique fora fecha, como nos modais de atendimento: o formulário tem só um ou dois campos
  const dialog = initDialog(dialogEl, {
    dismissSelector: '.js-lookup-dismiss',
    onClose() {
      current = null;
    },
  });

  function validators() {
    return lookup.hasLevel ? { name: validateName, level: validateLevel } : { name: validateName };
  }

  function validate() {
    const errors = {};
    for (const [name, rule] of Object.entries(validators())) {
      const message = rule(form.elements.namedItem(name).value);
      if (message) errors[name] = message;
    }
    return errors;
  }

  function payload() {
    const body = { name: nameField.value.trim() };
    if (lookup.hasLevel) body.level = Number(levelField.value);
    return body;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.hasAttribute('aria-busy')) return; // bloqueia envio duplo

    clearFieldErrors(form);
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      showFieldErrors(form, errors);
      return;
    }

    const mode = current ? 'edit' : 'create';
    setSubmitting(form, true);
    try {
      const saved = mode === 'edit'
        ? await api.put(`${lookup.endpoint}/${encodeURIComponent(current.id)}`, payload())
        : await api.post(lookup.endpoint, payload());
      dialog.close();
      notify.success(`${capitalize(lookup.singular)} ${saved.name} ${agree(lookup, mode === 'edit' ? 'atualizado' : 'cadastrado')}.`);
      onSaved(saved, mode);
    } catch (error) {
      handleError(error, { form }); // mantém o diálogo aberto e o que foi digitado
      // 409 de duplicado vem sem "fields": a mensagem diz se foi o nome ou o nível
      if (error?.status === 409) {
        const target = lookup.hasLevel && /nível/i.test(error.message) ? levelField : nameField;
        setFieldError(target, error.message);
        target.focus();
      }
    } finally {
      setSubmitting(form, false);
    }
  });

  // Erro aparece ao sair do campo preenchido e some assim que o valor fica válido
  form.addEventListener('focusout', (event) => {
    const rule = validators()[event.target.name];
    if (!rule || !event.target.value) return;
    const message = rule(event.target.value);
    if (message) setFieldError(event.target, message);
  });

  form.addEventListener('input', (event) => {
    const rule = validators()[event.target.name];
    if (!rule || event.target.getAttribute('aria-invalid') !== 'true') return;
    if (!rule(event.target.value)) clearFieldError(event.target);
  });

  return {
    /**
     * @param {{ lookup: object, item?: object | null, opener?: HTMLElement | null }} options
     */
    open({ lookup: config, item = null, opener = null }) {
      lookup = config;
      current = item;

      form.reset();
      clearFieldErrors(form);

      title.textContent = item ? `Editar ${lookup.singular}` : lookup.newLabel;
      submitButton.textContent = item ? 'Salvar alterações' : `Cadastrar ${lookup.singular}`;

      levelWrapper.hidden = !lookup.hasLevel;
      levelField.required = lookup.hasLevel;

      nameField.value = item?.name ?? '';
      levelField.value = item?.level ?? '';

      dialog.open(opener);
      nameField.focus();
    },
  };
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
