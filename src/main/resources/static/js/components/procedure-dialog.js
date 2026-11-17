import { api } from '../core/api.js';
import { handleError } from '../core/errors.js';
import { clearFieldError, clearFieldErrors, setFieldError, setSubmitting, showFieldErrors } from '../core/form.js';
import { formatDate, onlyDigits } from '../core/format.js';
import { notify } from '../core/notify.js';
import { todayIso } from '../core/validators.js';
import { addBusinessDays } from './authorization-deadline.js';
import { businessDaysLabel } from './authorization-table.js';
import { initDialog } from './dialog.js';

const ENDPOINT = 'api/authorization-types';

// Mesmos limites e mensagens do AuthorizationTypeRequest
const CODE_LENGTH = 8;
const NAME_MAX = 500;
const DAYS_MIN = 1;
const DAYS_MAX = 365;

const VALIDATORS = {
  code(value) {
    const code = String(value ?? '').trim();
    if (!code) return 'Informe o código do procedimento';
    if (!/^\d{8}$/.test(code)) return `O código deve ter exatamente ${CODE_LENGTH} dígitos`;
    return null;
  },
  name(value) {
    const name = String(value ?? '').trim();
    if (!name) return 'Informe o nome do procedimento';
    if (name.length > NAME_MAX) return `O nome deve ter no máximo ${NAME_MAX} caracteres`;
    return null;
  },
  maxDays(value) {
    if (String(value ?? '').trim() === '') return 'Informe em quantos dias úteis o procedimento deve ser atendido';
    const days = Number(value);
    if (!Number.isInteger(days) || days < DAYS_MIN || days > DAYS_MAX) return `Informe um número inteiro de ${DAYS_MIN} a ${DAYS_MAX}`;
    return null;
  },
};

/**
 * Diálogo de criar/editar procedimento (código TUSS, nome e prazo da ANS).
 * @param {HTMLDialogElement} dialogEl
 * @param {{ onSaved: (item: object, mode: 'create' | 'edit') => void }} callbacks
 */
export function initProcedureDialog(dialogEl, { onSaved }) {
  const form = dialogEl.querySelector('.js-procedure-form');
  const title = dialogEl.querySelector('.js-procedure-dialog-title');
  const submitButton = dialogEl.querySelector('.js-procedure-submit');
  const codeField = form.elements.namedItem('code');
  const nameField = form.elements.namedItem('name');
  const daysField = form.elements.namedItem('maxDays');
  const daysWrapper = form.querySelector('.js-days-field');
  const presets = [...form.querySelectorAll('.js-days-preset')];
  const codeCounter = form.querySelector('.js-code-counter');
  const nameCounter = form.querySelector('.js-name-counter');
  const preview = form.querySelector('.js-deadline-preview');

  let current = null;
  // Último prazo em dias digitado: volta ao alternar Imediato → Em dias úteis
  let lastDays = '';

  // Clique fora não fecha: o nome é longo e seria perdido por um clique distraído
  const dialog = initDialog(dialogEl, {
    closeOnBackdrop: false,
    dismissSelector: '.js-procedure-dismiss',
    onClose() {
      current = null;
    },
  });

  const isImmediate = () => form.elements.namedItem('deadlineKind').value === 'now';

  function activeValidators() {
    return isImmediate() ? { code: VALIDATORS.code, name: VALIDATORS.name } : VALIDATORS;
  }

  // ── Contadores, atalhos e prévia ───────────────────────────

  function updateCounters() {
    codeCounter.textContent = `${codeField.value.length}/${CODE_LENGTH}`;
    const nameLength = nameField.value.length;
    nameCounter.textContent = `${nameLength}/${NAME_MAX}`;
    nameCounter.setAttribute('aria-live', nameLength >= NAME_MAX - 20 ? 'polite' : 'off');
  }

  function syncPresets() {
    presets.forEach((button) => {
      button.setAttribute('aria-pressed', String(!isImmediate() && button.dataset.days === daysField.value));
    });
  }

  // Mesma conta de deadlineSummary (authorization-deadline.js): o dia da solicitação é o 1º
  function renderPreview() {
    const today = todayIso();
    preview.classList.toggle('c-procedure-preview--now', isImmediate());

    if (isImmediate()) {
      preview.textContent = 'Precisa ser atendido no mesmo dia em que a autorização é solicitada.';
      return;
    }

    if (VALIDATORS.maxDays(daysField.value)) {
      preview.textContent = '';
      return;
    }

    const days = Number(daysField.value);
    const lastDay = addBusinessDays(today, days - 1);
    preview.replaceChildren(
      `Uma autorização solicitada hoje (${formatDate(today)}) vence em `,
      Object.assign(document.createElement('strong'), { textContent: formatDate(lastDay) }),
      `, ${businessDaysLabel(days)} contando o dia da solicitação.`,
    );
  }

  function syncDeadlineKind({ focus = false } = {}) {
    const immediate = isImmediate();
    daysWrapper.hidden = immediate;
    daysField.required = !immediate;
    if (immediate) {
      clearFieldError(daysField);
    } else {
      if (!daysField.value) daysField.value = lastDays;
      if (focus) daysField.focus();
    }
    syncPresets();
    renderPreview();
  }

  // Código só com dígitos: limpa o que for colado com pontos ("1.01.01.012") sem perder os números
  codeField.addEventListener('input', () => {
    const digits = onlyDigits(codeField.value).slice(0, CODE_LENGTH);
    if (digits !== codeField.value) codeField.value = digits;
  });

  form.addEventListener('change', (event) => {
    if (event.target.name === 'deadlineKind') syncDeadlineKind({ focus: true });
  });

  presets.forEach((button) => {
    button.addEventListener('click', () => {
      daysField.value = button.dataset.days;
      lastDays = daysField.value;
      clearFieldError(daysField);
      syncPresets();
      renderPreview();
    });
  });

  // ── Validação ──────────────────────────────────────────────

  function validate() {
    const errors = {};
    for (const [name, rule] of Object.entries(activeValidators())) {
      const message = rule(form.elements.namedItem(name).value);
      if (message) errors[name] = message;
    }
    return errors;
  }

  function payload() {
    return {
      code: codeField.value.trim(),
      name: nameField.value.trim(),
      maxDays: isImmediate() ? 0 : Number(daysField.value),
    };
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
        ? await api.put(`${ENDPOINT}/${encodeURIComponent(current.id)}`, payload())
        : await api.post(ENDPOINT, payload());
      dialog.close();
      notify.success(`Procedimento ${saved.code} ${mode === 'edit' ? 'atualizado' : 'cadastrado'}.`);
      onSaved(saved, mode);
    } catch (error) {
      handleError(error, { form }); // mantém o diálogo aberto e o que foi digitado
      // 409 de duplicado vem sem "fields": a mensagem diz se foi o código ou o nome
      if (error?.status === 409) {
        const target = /código/i.test(error.message) ? codeField : nameField;
        setFieldError(target, error.message);
        target.focus();
      }
    } finally {
      setSubmitting(form, false);
    }
  });

  // Erro aparece ao sair do campo preenchido e some assim que o valor fica válido
  form.addEventListener('focusout', (event) => {
    const rule = activeValidators()[event.target.name];
    if (!rule || !event.target.value) return;
    const message = rule(event.target.value);
    if (message) setFieldError(event.target, message);
  });

  form.addEventListener('input', (event) => {
    if (event.target === daysField) {
      lastDays = daysField.value;
      syncPresets();
      renderPreview();
    }
    updateCounters();

    const rule = activeValidators()[event.target.name];
    if (!rule || event.target.getAttribute('aria-invalid') !== 'true') return;
    if (!rule(event.target.value)) clearFieldError(event.target);
  });

  return {
    /** @param {{ item?: object | null, opener?: HTMLElement | null }} options */
    open({ item = null, opener = null } = {}) {
      current = item;

      form.reset();
      clearFieldErrors(form);

      title.textContent = item ? `Editar procedimento ${item.code}` : 'Novo procedimento';
      submitButton.textContent = item ? 'Salvar alterações' : 'Cadastrar procedimento';

      codeField.value = item?.code ?? '';
      nameField.value = item?.name ?? '';

      const immediate = item?.maxDays === 0;
      form.querySelector(`[name="deadlineKind"][value="${immediate ? 'now' : 'days'}"]`).checked = true;
      // Sem prazo em dias para reaproveitar, sugere 10 dias úteis (o mais comum e o padrão da tabela)
      lastDays = item && !immediate ? String(item.maxDays) : '10';
      daysField.value = immediate ? '' : lastDays;

      updateCounters();
      syncDeadlineKind();

      dialog.open(opener);
      (item ? nameField : codeField).focus();
    },
  };
}
