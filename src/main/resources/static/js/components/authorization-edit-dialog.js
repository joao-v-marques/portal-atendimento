import { api } from '../core/api.js';
import { el } from '../core/dom.js';
import { handleError } from '../core/errors.js';
import { clearFieldError, clearFieldErrors, setFieldError, setSubmitting, showFieldErrors } from '../core/form.js';
import { maskPhone, onlyDigits } from '../core/format.js';
import { notify } from '../core/notify.js';
import { validateAuthorizationField, validateAuthorizationRequest } from '../core/validators.js';
import { beneficiaryLine, groupedCode } from './authorization-detail-dialog.js';
import { deadlinePanel } from './authorization-deadline.js';
import {
  applyPhoneMask,
  bindTransactionNumberInput,
  sanitizeTransactionNumber,
  updateTransactionCounter,
} from './authorization-fields.js';
import { deadlineLimitText } from './authorization-table.js';
import { initDialog } from './dialog.js';
import { initProcedureCombobox } from './procedure-combobox.js';

// Mesmo texto do ConflictException no AuthorizationRequestService (409): destaca o campo
const DUPLICATE_TRANSACTION_MESSAGE = 'Já existe uma autorização com este número de transação.';
const TEXT_FIELDS = ['transactionNumber', 'requestDate', 'beneficiaryName', 'beneficiaryPhone'];

/**
 * Modal de edição da autorização (PUT /api/authorization-requests/{id}, só ADMIN e MANAGER_SERVICE).
 * Status fica com Finalizar/Reabrir e documentos com o Detalhe: aqui só os dados do lançamento.
 *
 * @param {HTMLDialogElement} dialogEl
 * @param {{ onSaved: (item: object) => void }} callbacks
 */
export function initAuthorizationEditDialog(dialogEl, { onSaved }) {
  const form = dialogEl.querySelector('.js-edit-form');
  const subject = dialogEl.querySelector('.js-edit-subject');
  const counter = dialogEl.querySelector('.js-edit-counter');
  const procedureHint = dialogEl.querySelector('.js-edit-procedure-hint');
  const preview = dialogEl.querySelector('.js-edit-preview');
  const field = (name) => form.elements.namedItem(name);

  const PROCEDURE_HINT = procedureHint.textContent;

  let current = null;
  let initial = null;
  let types = [];

  // Formulário: clique fora não descarta o que foi digitado; Esc, ✕ e Cancelar fecham
  const dialog = initDialog(dialogEl, {
    closeOnBackdrop: false,
    dismissSelector: '.js-edit-dismiss',
    onClose() {
      current = null;
      initial = null;
    },
  });

  const procedure = initProcedureCombobox(dialogEl.querySelector('.js-edit-procedure'), {
    onChange(item) {
      if (!current) return;
      if (item) clearFieldError(field('authorizationTypeId'));
      renderProcedureHint();
      renderPreview();
    },
  });

  bindTransactionNumberInput(field('transactionNumber'));

  // ── Leitura ────────────────────────────────────────────────

  function readValues() {
    return {
      transactionNumber: field('transactionNumber').value.trim(),
      requestDate: field('requestDate').value,
      authorizationTypeId: procedure.selected?.id ?? null,
      beneficiaryName: field('beneficiaryName').value.trim(),
      beneficiaryPhone: onlyDigits(field('beneficiaryPhone').value),
    };
  }

  function hasChanges(values) {
    return Object.keys(values).some((key) => values[key] !== initial[key]);
  }

  // ── Renderização ───────────────────────────────────────────

  function renderProcedureHint() {
    const type = procedure.selected;
    procedureHint.textContent = type
      ? `Código ${type.code}. Prazo da ANS: ${deadlineLimitText(type.maxDays).toLowerCase()}.`
      : PROCEDURE_HINT;
  }

  // A régua com a data e o procedimento do formulário: mostra o efeito antes de salvar
  function renderPreview() {
    const type = procedure.selected;
    const requestDate = field('requestDate').value;
    if (!type || !requestDate) {
      preview.replaceChildren();
      return;
    }
    preview.replaceChildren(deadlinePanel({
      ...current,
      requestDate,
      authorizationTypeName: type.name,
      authorizationTypeMaxDays: type.maxDays,
    }, { compact: true }));
  }

  // Ativos + o atual mesmo inativo: o backend aceita manter, só recusa trocar para um inativo
  function procedureOptions(item) {
    return types
      .filter((type) => type.isActive || type.id === item.authorizationTypeId)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  // ── Envio ──────────────────────────────────────────────────

  async function handleSubmit(event) {
    event.preventDefault();
    if (!current || form.hasAttribute('aria-busy')) return; // bloqueia envio duplo

    clearFieldErrors(form);
    const values = readValues();
    const errors = validateAuthorizationRequest({ ...values, authorizationStatusId: current.authorizationStatusId });
    if (Object.keys(errors).length > 0) {
      showFieldErrors(form, errors);
      notify.error('Revise os campos destacados.');
      return;
    }

    // Nada mudou: não há o que salvar, só fecha
    if (!hasChanges(values)) {
      dialog.close();
      return;
    }

    setSubmitting(form, true);
    try {
      const saved = await api.put(`api/authorization-requests/${encodeURIComponent(current.id)}`, {
        ...values,
        authorizationStatusId: current.authorizationStatusId, // obrigatório no DTO, ignorado no update
      });
      dialog.close();
      notify.success(`Autorização ${saved.transactionNumber} atualizada.`);
      onSaved(saved);
    } catch (error) {
      // Mantém o modal aberto e o que foi digitado
      handleError(error, { form });
      if (error?.message === DUPLICATE_TRANSACTION_MESSAGE) {
        setFieldError(field('transactionNumber'), 'Este número de transação já está em outra autorização');
        field('transactionNumber').focus();
      }
    } finally {
      setSubmitting(form, false);
    }
  }

  // ── Eventos ────────────────────────────────────────────────

  form.addEventListener('submit', handleSubmit);

  form.addEventListener('input', (event) => {
    const target = event.target;
    if (target === field('transactionNumber')) {
      sanitizeTransactionNumber(target);
      updateTransactionCounter(counter, target);
    }
    if (target === field('beneficiaryPhone')) applyPhoneMask(target);
    if (target === field('requestDate')) renderPreview();

    // Enquanto digita, só remove o erro quando o valor fica válido; nunca mostra erro novo
    if (TEXT_FIELDS.includes(target.name) && target.getAttribute('aria-invalid') === 'true'
      && !validateAuthorizationField(target.name, readValues()[target.name])) {
      clearFieldError(target);
    }
  });

  // Erro aparece ao sair do campo (só se digitou algo)
  form.addEventListener('focusout', (event) => {
    const target = event.target;
    if (!TEXT_FIELDS.includes(target.name) || !target.value) return;
    const message = validateAuthorizationField(target.name, readValues()[target.name]);
    if (message) setFieldError(target, message);
  });

  return {
    /** Tipos carregados uma vez pela página (com isActive) e reaproveitados a cada abertura */
    setTypes(list) {
      types = list;
    },

    open(item, opener = null) {
      if (!item) return;
      current = item;

      form.reset();
      clearFieldErrors(form);

      subject.replaceChildren(
        el('span', { className: 'c-auth-code' }, groupedCode(item.transactionNumber)),
        ...beneficiaryLine(item),
      );

      field('transactionNumber').value = item.transactionNumber ?? '';
      field('requestDate').value = item.requestDate ?? '';
      field('beneficiaryName').value = item.beneficiaryName ?? '';
      field('beneficiaryPhone').value = maskPhone(item.beneficiaryPhone ?? '');
      updateTransactionCounter(counter, field('transactionNumber'));

      const options = procedureOptions(item);
      if (options.length > 0) {
        procedure.setItems(options);
        procedure.select(item.authorizationTypeId);
      } else {
        procedure.setUnavailable(); // tipos não carregaram: o envio cai na validação do procedimento
      }

      initial = readValues();
      renderProcedureHint();
      renderPreview();

      dialog.open(opener);
      field('transactionNumber').focus();
    },
  };
}
