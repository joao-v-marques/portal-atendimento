import { el } from '../core/dom.js';
import { formatDate, formatDateTime, formatPhone } from '../core/format.js';
import { descriptionItem } from './authorization-detail-dialog.js';
import { statusBadge } from './authorization-table.js';
import { initDialog } from './dialog.js';
import { isFinished } from './service-request-table.js';
import { initTabs } from './tabs.js';

// "12345678901" → "123.456.789-01"; fora do padrão aparece como veio
function formatCpf(value) {
  const cpf = String(value ?? '');
  return /^\d{11}$/.test(cpf) ? `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}` : cpf;
}

// Destaque do Resumo: rótulo + valor (texto ou elemento, como o badge de status)
function highlightItem(term, value) {
  return el('div', { className: 'l-sr-highlights__item' }, [
    el('dt', { className: 'l-sr-highlights__term', text: term }),
    typeof value === 'string' || value == null
      ? el('dd', { className: 'l-sr-highlights__value', text: value || '—' })
      : el('dd', { className: 'l-sr-highlights__value' }, [value]),
  ]);
}

/**
 * Modal com todos os dados do atendimento. As ações do rodapé fecham este modal e só
 * depois chamam o callback, que abre a próxima etapa (em sequência, nunca empilhado — guia 11.7).
 *
 * @param {HTMLDialogElement} dialogEl
 * @param {{
 *   onEdit: (item: object, opener: HTMLElement | null) => void,
 *   onFinish: (item: object, opener: HTMLElement | null) => void,
 *   onReopen: (item: object, opener: HTMLElement | null) => void,
 * }} callbacks
 * @returns {{ open: (item: object, opener: HTMLElement) => void }}
 */
export function initServiceRequestDetailDialog(dialogEl, { onEdit, onFinish, onReopen }) {
  const code = dialogEl.querySelector('.js-detail-code');
  const highlights = dialogEl.querySelector('.js-detail-highlights');
  const status = dialogEl.querySelector('.js-detail-status');
  const requestList = dialogEl.querySelector('.js-detail-request');
  const requesterList = dialogEl.querySelector('.js-detail-requester');
  const description = dialogEl.querySelector('.js-detail-description');
  const resolutionSection = dialogEl.querySelector('.js-detail-resolution-section');
  const resolution = dialogEl.querySelector('.js-detail-resolution');
  const deadlinesList = dialogEl.querySelector('.js-detail-deadlines');
  const auditList = dialogEl.querySelector('.js-detail-audit');
  const editButton = dialogEl.querySelector('.js-detail-edit');
  const finishButton = dialogEl.querySelector('.js-detail-finish');
  const reopenButton = dialogEl.querySelector('.js-detail-reopen');
  const closeButton = dialogEl.querySelector('.js-detail-dismiss');

  let current = null;
  let opener = null;

  const tabs = initTabs(dialogEl.querySelector('.js-detalhe-tabs'));

  const dialog = initDialog(dialogEl, {
    dismissSelector: '.js-detail-dismiss',
    onClose() {
      current = null;
      opener = null;
    },
  });

  function render(item) {
    code.textContent = item.protocolNumber;
    status.replaceChildren(statusBadge(item.statusName));

    highlights.replaceChildren(
      highlightItem('Categoria', item.categoryName),
      highlightItem('Solicitante', item.requesterName),
      highlightItem('Responsável', item.assignedToName),
      highlightItem('Aberto em', formatDateTime(item.openedAt)),
      highlightItem('Severidade', item.severityName),
    );

    requestList.replaceChildren(
      descriptionItem('Protocolo', item.protocolNumber),
      descriptionItem('Status', item.statusName),
      descriptionItem('Categoria', item.categoryName),
      descriptionItem('Canal', item.channelName),
      descriptionItem('Tipo', item.typeName),
      descriptionItem('Severidade', item.severityName),
    );

    requesterList.replaceChildren(
      descriptionItem('Nome', item.requesterName),
      descriptionItem('Carteirinha', item.requesterCardNumber),
      descriptionItem('CPF', formatCpf(item.requesterCpf)),
      descriptionItem('Data de nascimento', item.requesterBirthDate ? formatDate(item.requesterBirthDate) : ''),
      descriptionItem('Telefone', item.requesterPhone ? formatPhone(item.requesterPhone) : ''),
      descriptionItem('E-mail', item.requesterEmail),
    );

    description.textContent = item.description || '—';

    // Reaberto mantém a resolução anterior até a próxima finalização (regra do backend)
    resolutionSection.hidden = !item.resolution;
    resolution.textContent = item.resolution ?? '';

    deadlinesList.replaceChildren(
      descriptionItem('Responsável', item.assignedToName),
      descriptionItem('Aberto em', formatDateTime(item.openedAt)),
      descriptionItem('Finalizado em', item.closedAt ? formatDateTime(item.closedAt) : ''),
    );

    auditList.replaceChildren(
      descriptionItem('Cadastrado por', item.insertedByName),
      descriptionItem('Cadastrado em', formatDateTime(item.createdAt)),
      descriptionItem('Atualizado por', item.updatedByName),
      descriptionItem('Atualizado em', item.updatedAt ? formatDateTime(item.updatedAt) : ''),
    );

    // Mesmas regras da linha da tabela: finalizado só reabre
    const finished = isFinished(item);
    editButton.hidden = finished;
    finishButton.hidden = finished;
    reopenButton.hidden = !finished;
  }

  // Fecha primeiro (o foco volta ao botão da linha) e só então abre a próxima etapa
  function handOff(callback) {
    const item = current;
    const target = opener;
    dialog.close();
    callback(item, target);
  }

  editButton.addEventListener('click', () => handOff(onEdit));
  finishButton.addEventListener('click', () => handOff(onFinish));
  reopenButton.addEventListener('click', () => handOff(onReopen));

  return {
    open(item, openerElement) {
      if (!item) return;
      current = item;
      opener = openerElement;
      render(item);
      tabs.reset(); // sempre abre no Resumo
      dialog.open(openerElement);
      closeButton.focus();
    },
  };
}
