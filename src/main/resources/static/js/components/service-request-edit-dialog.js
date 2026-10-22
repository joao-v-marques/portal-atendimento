import { api } from '../core/api.js';
import { el } from '../core/dom.js';
import { handleError } from '../core/errors.js';
import { clearFieldError, clearFieldErrors, setFieldError, setSubmitting, showFieldErrors } from '../core/form.js';
import { notify } from '../core/notify.js';
import { todayIso, validateServiceRequest, validateServiceRequestField } from '../core/validators.js';
import { initDialog } from './dialog.js';
import { FINISHED_STATUS_ID } from './service-request-table.js';
import { initTabs } from './tabs.js';

const FIELD_NAMES = [
  'protocolNumber', 'openedAt', 'categoryId', 'channelId', 'typeId', 'severityId', 'statusId',
  'requesterName', 'requesterCardNumber', 'requesterCpf', 'requesterBirthDate', 'requesterPhone',
  'requesterEmail', 'description',
];

const OPTIONAL_TEXT = ['requesterCpf', 'requesterPhone', 'requesterEmail'];

/**
 * OffsetDateTime → "AAAA-MM-DDTHH:mm" no fuso do navegador (formato do input datetime-local).
 * @param {string | null | undefined} iso
 */
function toLocalInputValue(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

/**
 * Preenche um select com id no value (o DTO espera o id, não o nome). Mostra os ativos e
 * mantém o valor atual mesmo inativo, para ele não sumir da tela ao editar.
 * @param {HTMLSelectElement} select
 * @param {{ id: number, name: string, isActive?: boolean, active?: boolean }[]} options
 * @param {number | null} selectedId
 * @param {{ emptyLabel: string, exclude?: number[] }} config
 */
function fillOptions(select, options, selectedId, { emptyLabel, exclude = [] }) {
  const isActive = (option) => option.isActive ?? option.active ?? true;
  const available = options.filter((option) =>
    !exclude.includes(option.id) && (isActive(option) || option.id === selectedId));

  select.replaceChildren(
    el('option', { text: emptyLabel, attrs: { value: '' } }),
    ...available.map((option) => el('option', { text: option.name, attrs: { value: String(option.id) } })),
  );
  select.value = selectedId == null ? '' : String(selectedId);
}

/**
 * Diálogo de edição do atendimento (PUT /api/service-requests/{id}).
 * O responsável é só leitura: a lista de usuários é exclusiva do ADMIN, então o PUT reenvia o atual.
 *
 * @param {HTMLDialogElement} dialogEl
 * @param {{ onSaved: (item: object) => void }} callbacks
 */
export function initServiceRequestEditDialog(dialogEl, { onSaved }) {
  const form = dialogEl.querySelector('.js-edit-form');
  const code = dialogEl.querySelector('.js-edit-code');
  const assignee = dialogEl.querySelector('.js-edit-assignee');

  let current = null;
  let initialOpenedAt = '';
  let lookups = { categories: [], channels: [], types: [], severities: [], statuses: [] };

  const tabs = initTabs(dialogEl.querySelector('.js-editar-tabs'));

  // Clique fora fecha, como no detalhe (pedido do usuário): o que não foi salvo é descartado
  const dialog = initDialog(dialogEl, {
    dismissSelector: '.js-edit-dismiss',
    onClose() {
      current = null;
    },
  });

  function field(name) {
    return form.elements.namedItem(name);
  }

  // Campo com erro pode estar numa aba escondida: abre a aba dele (a do primeiro erro),
  // marca as abas com erro e só então foca, para o foco nunca cair num campo invisível
  function revealErrors() {
    const invalid = [...form.querySelectorAll('[aria-invalid="true"]')];
    if (invalid.length === 0) return;

    const keyOf = (fieldEl) => fieldEl.closest('[data-tab]')?.dataset.tab;
    tabs.markInvalid([...new Set(invalid.map(keyOf))]);

    const first = invalid[0];
    if (first.closest('[hidden]')) tabs.select(keyOf(first));
    first.focus();
  }

  function readValues() {
    return Object.fromEntries(FIELD_NAMES.map((name) => [name, String(field(name).value)]));
  }

  // Corpo no formato do ServiceRequestRequest: ids numéricos e opcionais vazios como null
  function toRequestBody(values) {
    const body = {
      protocolNumber: values.protocolNumber.trim(),
      categoryId: Number(values.categoryId),
      channelId: Number(values.channelId),
      typeId: Number(values.typeId),
      severityId: values.severityId ? Number(values.severityId) : null,
      statusId: Number(values.statusId),
      requesterCardNumber: values.requesterCardNumber.trim(),
      requesterName: values.requesterName.trim(),
      requesterBirthDate: values.requesterBirthDate || null,
      description: values.description.trim(),
      assignedToId: current.assignedToId,
      // Só manda a abertura se ela mudou: o input não tem segundos, e reenviar arredondaria a data original
      openedAt: values.openedAt && values.openedAt !== initialOpenedAt ? new Date(values.openedAt).toISOString() : null,
    };
    OPTIONAL_TEXT.forEach((name) => { body[name] = values[name].trim() || null; });
    return body;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (form.hasAttribute('aria-busy')) return; // bloqueia envio duplo

    clearFieldErrors(form);

    const values = readValues();
    const errors = validateServiceRequest(values);
    if (Object.keys(errors).length > 0) {
      showFieldErrors(form, errors);
      revealErrors();
      notify.error('Revise os campos destacados.');
      return;
    }

    setSubmitting(form, true);
    try {
      const saved = await api.put(`api/service-requests/${encodeURIComponent(current.id)}`, toRequestBody(values));
      dialog.close();
      notify.success(`Atendimento ${saved.protocolNumber} atualizado.`);
      onSaved(saved);
    } catch (error) {
      // Mantém o diálogo aberto e o que foi digitado
      handleError(error, { form });
      revealErrors(); // erros de campo vindos do backend (400 com "fields")
    } finally {
      setSubmitting(form, false);
    }
  }

  form.addEventListener('submit', handleSubmit);

  // Erro aparece ao sair do campo (só se digitou algo) e é limpo assim que o valor fica válido
  form.addEventListener('blur', (event) => {
    const target = event.target;
    if (!FIELD_NAMES.includes(target.name) || !target.value) return;
    const message = validateServiceRequestField(target.name, target.value);
    if (message) setFieldError(target, message);
  }, true);

  form.addEventListener('input', (event) => {
    const target = event.target;
    if (!FIELD_NAMES.includes(target.name) || target.getAttribute('aria-invalid') !== 'true') return;
    if (validateServiceRequestField(target.name, target.value)) return;
    clearFieldError(target);
    tabs.markInvalid([...new Set([...form.querySelectorAll('[aria-invalid="true"]')]
      .map((fieldEl) => fieldEl.closest('[data-tab]')?.dataset.tab))]);
  });

  return {
    /** Cadastros auxiliares carregados uma vez pela página e reaproveitados a cada abertura */
    setLookups(loaded) {
      lookups = { ...lookups, ...loaded };
    },

    open(item, opener = null) {
      if (!item) return;
      current = item;

      // reset() antes de atribuir: ele volta aos defaults do HTML
      form.reset();
      clearFieldErrors(form);
      tabs.reset(); // sempre abre no Resumo, sem marcas de erro

      code.textContent = item.protocolNumber;
      assignee.value = item.assignedToName || '—';

      fillOptions(field('categoryId'), lookups.categories, item.categoryId, { emptyLabel: 'Selecione' });
      fillOptions(field('channelId'), lookups.channels, item.channelId, { emptyLabel: 'Selecione' });
      fillOptions(field('typeId'), lookups.types, item.typeId, { emptyLabel: 'Selecione' });
      fillOptions(field('severityId'), lookups.severities, item.severityId, { emptyLabel: 'Sem severidade' });
      // Finalizado fica de fora: o PUT recusa, a finalização tem fluxo próprio (com resolução)
      fillOptions(field('statusId'), lookups.statuses, item.statusId, { emptyLabel: 'Selecione', exclude: [FINISHED_STATUS_ID] });

      field('protocolNumber').value = item.protocolNumber ?? '';
      initialOpenedAt = toLocalInputValue(item.openedAt);
      field('openedAt').value = initialOpenedAt;
      field('requesterName').value = item.requesterName ?? '';
      field('requesterCardNumber').value = item.requesterCardNumber ?? '';
      field('requesterCpf').value = item.requesterCpf ?? '';
      field('requesterBirthDate').value = item.requesterBirthDate ?? '';
      field('requesterBirthDate').max = todayIso();
      field('requesterPhone').value = item.requesterPhone ?? '';
      field('requesterEmail').value = item.requesterEmail ?? '';
      field('description').value = item.description ?? '';

      dialog.open(opener);
      field('protocolNumber').focus();
    },
  };
}
