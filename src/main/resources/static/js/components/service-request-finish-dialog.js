import { api } from '../core/api.js';
import { handleError } from '../core/errors.js';
import { clearFieldError, clearFieldErrors, setFieldError, setSubmitting, showFieldErrors } from '../core/form.js';
import { formatDateTime } from '../core/format.js';
import { notify } from '../core/notify.js';
import { validateServiceRequest, validateServiceRequestField } from '../core/validators.js';
import { descriptionItem } from './authorization-detail-dialog.js';
import { initDialog } from './dialog.js';

/**
 * Diálogo de finalização (PATCH /api/service-requests/{id}/finish), com a resolução obrigatória.
 * @param {HTMLDialogElement} dialogEl
 * @param {{ onFinished: (item: object) => void }} callbacks
 */
export function initServiceRequestFinishDialog(dialogEl, { onFinished }) {
  const form = dialogEl.querySelector('.js-finish-form');
  const code = dialogEl.querySelector('.js-finish-code');
  const details = dialogEl.querySelector('.js-finish-details');
  const resolutionField = form.elements.namedItem('resolution');
  // Grupo de radios: o erro fica no fieldset (#finalizar-resolvido-error), não num campo único
  const resolvedGroup = dialogEl.querySelector('.js-finish-resolved');
  const resolvedRadios = form.elements.namedItem('resolved');

  let current = null;

  // Clique fora não fecha: perderia a resolução digitada
  const dialog = initDialog(dialogEl, {
    closeOnBackdrop: false,
    dismissSelector: '.js-finish-dismiss',
    onClose() {
      current = null;
    },
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.hasAttribute('aria-busy')) return; // bloqueia envio duplo

    clearFieldErrors(form);

    const values = { resolution: resolutionField.value };
    const errors = validateServiceRequest(values);
    const resolvedValue = resolvedRadios.value; // "true" | "false" | "" (nenhum marcado)
    if (!resolvedValue) setFieldError(resolvedGroup, 'Informe se o problema foi resolvido');
    if (Object.keys(errors).length > 0 || !resolvedValue) {
      showFieldErrors(form, errors);
      if (!resolvedValue) resolvedRadios[0].focus(); // pergunta vem antes da resolução no formulário
      return;
    }

    setSubmitting(form, true);
    try {
      const finished = await api.patch(
        `api/service-requests/${encodeURIComponent(current.id)}/finish`,
        { resolution: values.resolution.trim(), resolved: resolvedValue === 'true' },
      );
      dialog.close();
      notify.success(`Atendimento ${finished.protocolNumber} finalizado.`);
      onFinished(finished);
    } catch (error) {
      handleError(error, { form });
    } finally {
      setSubmitting(form, false);
    }
  });

  resolvedGroup.addEventListener('change', () => clearFieldError(resolvedGroup));

  resolutionField.addEventListener('input', () => {
    if (resolutionField.getAttribute('aria-invalid') !== 'true') return;
    if (!validateServiceRequestField('resolution', resolutionField.value)) clearFieldError(resolutionField);
  });

  return {
    open(item, opener = null) {
      if (!item) return;
      current = item;

      form.reset();
      clearFieldErrors(form);

      code.textContent = item.protocolNumber;
      details.replaceChildren(
        descriptionItem('Solicitante', item.requesterName),
        descriptionItem('Categoria', item.categoryName),
        descriptionItem('Tipo', item.typeName),
        descriptionItem('Aberto em', formatDateTime(item.openedAt)),
      );
      // Reaberto: parte da resolução anterior, que a pessoa só complementa
      resolutionField.value = item.resolution ?? '';

      dialog.open(opener);
      resolvedRadios[0].focus();
    },
  };
}
