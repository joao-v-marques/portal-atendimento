import { api } from '../core/api.js';
import { el, saveBlob } from '../core/dom.js';
import { handleError } from '../core/errors.js';
import { fileTypeLabel, formatDate, formatDateTime, formatFileSize, formatPhone } from '../core/format.js';
import { statusBadge } from './authorization-table.js';

const SKELETON_DOCUMENTS = 2;

function descriptionItem(term, value) {
  return el('div', { className: 'c-description-list__item' }, [
    el('dt', { className: 'c-description-list__term', text: term }),
    el('dd', { className: 'c-description-list__value', text: value || '—' }),
  ]);
}

function compactState({ icon, title, text, actions = [] }) {
  return el('div', { className: 'c-empty-state c-empty-state--compact' }, [
    el('span', { className: 'c-empty-state__icon', attrs: { 'aria-hidden': 'true' } }, [
      el('span', { className: `c-icon c-icon--${icon}` }),
    ]),
    el('p', { className: 'c-empty-state__title', text: title }),
    ...(text ? [el('p', { className: 'c-empty-state__text', text })] : []),
    ...(actions.length ? [el('div', { className: 'c-empty-state__actions' }, actions)] : []),
  ]);
}

function documentItem(doc) {
  const isImage = String(doc.contentType).startsWith('image/');
  const name = doc.originalFilename || 'documento';

  return el('li', { className: 'c-document-list__item' }, [
    el('span', { className: 'c-document-list__icon', attrs: { 'aria-hidden': 'true' } }, [
      el('span', { className: `c-icon c-icon--${isImage ? 'file-image' : 'file-text'}` }),
    ]),
    el('div', { className: 'c-document-list__info' }, [
      el('span', { className: 'c-document-list__name', text: name, attrs: { title: name } }),
      el('span', { className: 'c-document-list__meta', text: `${fileTypeLabel(doc.contentType)} · ${formatFileSize(doc.sizeBytes)}` }),
      el('span', {
        className: 'c-document-list__meta',
        text: `Enviado em ${formatDateTime(doc.uploadedAt)}${doc.uploadedByName ? ` por ${doc.uploadedByName}` : ''}`,
      }),
    ]),
    el('button', {
      className: 'c-button c-button--secondary c-button--sm js-download',
      attrs: { type: 'button', 'data-document-id': String(doc.id), 'aria-label': `Baixar ${name}` },
    }, [
      el('span', { className: 'c-icon c-icon--sm c-icon--download', attrs: { 'aria-hidden': 'true' } }),
      el('span', { className: 'c-button__label--collapsible', text: 'Baixar' }),
    ]),
  ]);
}

function documentSkeleton() {
  return el('li', { className: 'c-document-list__item', attrs: { 'aria-hidden': 'true' } }, [
    el('span', { className: 'c-skeleton c-document-list__icon' }),
    el('div', { className: 'c-document-list__info' }, [
      el('span', { className: 'c-skeleton c-skeleton--name' }),
    ]),
  ]);
}

/**
 * Modal de detalhe de uma autorização, com documentos e download.
 * @param {HTMLDialogElement} dialog
 * @returns {{ open: (item: object, opener: HTMLElement) => void }}
 */
export function initAuthorizationDetailDialog(dialog) {
  const code = dialog.querySelector('.js-detail-code');
  const status = dialog.querySelector('.js-detail-status');
  const details = dialog.querySelector('.js-detail-list');
  const documentsSection = dialog.querySelector('.js-documents');
  const documentsCount = dialog.querySelector('.js-documents-count');
  const documentsArea = dialog.querySelector('.js-documents-area');
  const closeButton = dialog.querySelector('.js-detail-close');

  let current = null;
  let opener = null;
  let controller = null;
  let documentsById = new Map();
  let pointerDownOnBackdrop = false;

  // ── Renderização ───────────────────────────────────────────

  function renderDetails(item) {
    code.textContent = item.transactionNumber;
    status.replaceChildren(statusBadge(item.authorizationStatusName));
    details.replaceChildren(
      descriptionItem('Data da solicitação', formatDate(item.requestDate)),
      descriptionItem('Tipo', item.authorizationTypeName),
      descriptionItem('Beneficiário', item.beneficiaryName),
      descriptionItem('Telefone', formatPhone(item.beneficiaryPhone)),
      descriptionItem('Cadastrado em', formatDateTime(item.createdAt)),
      descriptionItem('Cadastrado por', item.insertedByName),
    );
  }

  function renderDocumentsLoading() {
    documentsSection.setAttribute('aria-busy', 'true');
    documentsCount.textContent = '';
    const list = el('ul', { className: 'c-document-list' });
    for (let i = 0; i < SKELETON_DOCUMENTS; i++) list.append(documentSkeleton());
    documentsArea.replaceChildren(list);
  }

  function renderDocuments(documents) {
    documentsSection.removeAttribute('aria-busy');
    documentsById = new Map(documents.map((doc) => [doc.id, doc]));
    documentsCount.textContent = `(${documents.length})`;

    if (documents.length === 0) {
      documentsArea.replaceChildren(compactState({
        icon: 'file-text',
        title: 'Nenhum documento anexado',
        text: 'Esta autorização não tem documentos enviados.',
      }));
      return;
    }

    const list = el('ul', { className: 'c-document-list' });
    documents.forEach((doc) => list.append(documentItem(doc)));
    documentsArea.replaceChildren(list);
  }

  function renderDocumentsError() {
    documentsSection.removeAttribute('aria-busy');
    documentsCount.textContent = '';
    const retry = el('button', { className: 'c-button c-button--secondary c-button--sm', text: 'Tentar novamente', attrs: { type: 'button' } });
    retry.addEventListener('click', loadDocuments);
    documentsArea.replaceChildren(compactState({
      icon: 'file-text',
      title: 'Não foi possível carregar os documentos',
      actions: [retry],
    }));
  }

  // ── Dados ──────────────────────────────────────────────────

  async function loadDocuments() {
    controller?.abort();
    controller = new AbortController();
    const { signal } = controller;
    const item = current;

    renderDocumentsLoading();
    try {
      const documents = await api.get(`api/authorization-requests/${encodeURIComponent(item.id)}/documents`, { signal });
      renderDocuments(documents);
    } catch (error) {
      if (signal.aborted) return; // modal fechado ou outra autorização aberta: sem aviso
      renderDocumentsError();
      handleError(error);
    }
  }

  async function downloadDocument(button) {
    const doc = documentsById.get(Number(button.dataset.documentId));
    if (!doc || button.disabled) return;

    button.disabled = true;
    button.classList.add('is-loading');
    try {
      const path = `api/authorization-requests/${encodeURIComponent(current.id)}/documents/${encodeURIComponent(doc.id)}/download`;
      const { blob, filename } = await api.download(path);
      // Sem Notyf de sucesso: o próprio download do navegador é o feedback
      saveBlob(blob, filename || doc.originalFilename);
    } catch (error) {
      handleError(error);
    } finally {
      button.disabled = false;
      button.classList.remove('is-loading');
    }
  }

  // ── Eventos ────────────────────────────────────────────────

  documentsArea.addEventListener('click', (event) => {
    const button = event.target.closest('.js-download');
    if (button) downloadDocument(button);
  });

  // Idempotente: roda no clique de fechar, no Esc (cancel) e, por garantia, no evento close.
  // Não depender só do close: ele é assíncrono e pode atrasar (ex.: aba em segundo plano).
  function finishClosing() {
    if (!current) return;
    controller?.abort();
    current = null;
    const target = opener;
    opener = null;
    // Firefox/Safari não focam o botão no clique, então a restauração nativa não basta
    target?.focus();
  }

  function close() {
    dialog.close();
    finishClosing();
  }

  dialog.querySelectorAll('.js-detail-dismiss').forEach((button) => {
    button.addEventListener('click', close);
  });

  // Fecha no backdrop só se o clique começou nele (arrastar uma seleção de texto para fora não fecha)
  dialog.addEventListener('pointerdown', (event) => {
    pointerDownOnBackdrop = event.target === dialog;
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog && pointerDownOnBackdrop) close();
  });

  // Esc: assume o fechamento. No cancel o fundo ainda está inerte e o foco não voltaria ao botão da linha
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('close', finishClosing);

  return {
    open(item, openerElement) {
      if (!item) return;
      current = item;
      opener = openerElement;
      renderDetails(item);
      dialog.showModal();
      closeButton.focus();
      loadDocuments();
    },
  };
}
