import { api } from '../core/api.js';
import { el, saveBlob } from '../core/dom.js';
import { handleError } from '../core/errors.js';
import { fileTypeLabel, formatDate, formatDateTime, formatFileSize, formatPhone } from '../core/format.js';
import { notify } from '../core/notify.js';
import { MAX_FILES } from '../core/validators.js';
import { deadlinePanel } from './authorization-deadline.js';
import { deadlineLevel, finishLead, finishLeadText, statusBadge } from './authorization-table.js';
import { initFileUpload } from './file-upload.js';

const SKELETON_DOCUMENTS = 2;

/**
 * Texto pronto para enviar ao beneficiário. Os dias só aparecem quando houve antecedência:
 * no limite ou com atraso a mensagem não cita prazo.
 * @param {{ beneficiaryName?: string, transactionNumber?: string, requestDate?: string, finishDate?: string | null }} item
 */
function beneficiaryMessage(item) {
  const name = item.beneficiaryName?.trim();
  const greeting = name ? `Olá, ${name}!\n` : 'Olá!\n';
  const lead = finishLead(item);
  const authorized = lead && lead.early > 0
    ? 'Informamos que sua solicitação foi AUTORIZADA ANTES DO PRAZO máximo estabelecido pela Agência Nacional de Saúde Suplementar (ANS).\n\n'
      + `Solicitação nº ${item.transactionNumber} foi autorizada com ${finishLeadText(lead)}.\n`
    : `Informamos que sua solicitação nº ${item.transactionNumber} foi AUTORIZADA.\n`;
  return `${greeting}${authorized}\n`
    + 'A Unimed busca oferecer agilidade e qualidade no atendimento, mantendo o compromisso com o cuidado e a atenção aos nossos beneficiários.\n'
    + 'Conte conosco! 💚\n'
    + 'Em caso de dúvidas, estamos à disposição.\n'
    + 'Unimed São Sebastião do Paraíso';
}

export function descriptionItem(term, value) {
  return el('div', { className: 'c-description-list__item' }, [
    el('dt', { className: 'c-description-list__term', text: term }),
    el('dd', { className: 'c-description-list__value', text: value || '—' }),
  ]);
}

/**
 * Nº da transação em grupos de 4 para ler e conferir (ex.: ao telefone). Os grupos são só
 * espaçamento visual: copiar o título continua dando os 12 dígitos juntos.
 * @param {string} code
 */
export function groupedCode(code) {
  const value = String(code ?? '');
  const groups = value.match(/.{1,4}/g) ?? [value];
  return groups.map((group) => el('span', { className: 'c-auth-code__group', text: group }));
}

/**
 * Beneficiário em destaque e telefone clicável (abre o discador no celular).
 * @param {{ beneficiaryName?: string, beneficiaryPhone?: string }} item
 */
export function beneficiaryLine(item) {
  const nodes = [el('span', { className: 'c-auth-dialog__beneficiary', text: item.beneficiaryName || 'Beneficiário não informado' })];
  const digits = String(item.beneficiaryPhone ?? '').replace(/\D/g, '');
  if (digits) {
    nodes.push(el('a', {
      className: 'c-auth-dialog__phone',
      text: formatPhone(item.beneficiaryPhone),
      attrs: { href: `tel:+55${digits}`, 'aria-label': `Ligar para ${formatPhone(item.beneficiaryPhone)}` },
    }));
  }
  return nodes;
}

/**
 * Par rótulo → valor do bloco de dados; `note` vira uma segunda linha discreta.
 * @param {string} term
 * @param {string | null | undefined} value
 * @param {{ wide?: boolean, note?: string }} [options]
 */
export function fact(term, value, { wide = false, note } = {}) {
  return el('div', { className: `c-auth-facts__item${wide ? ' c-auth-facts__item--wide' : ''}` }, [
    el('dt', { className: 'c-auth-facts__term', text: term }),
    el('dd', { className: 'c-auth-facts__value' }, [
      value || '—',
      ...(note ? [el('span', { className: 'c-auth-facts__note', text: note })] : []),
    ]),
  ]);
}

/**
 * Conteúdo da confirmação de Finalizar/Reabrir (js-finish-dialog): quem é, como fica o prazo
 * da ANS com a ação e os dados para conferir. Título, texto e botão ficam com o confirm-dialog.
 * @param {HTMLDialogElement} dialog
 * @param {object} item
 * @param {'finish' | 'reopen'} mode
 */
export function renderFinishSummary(dialog, item, mode) {
  dialog.querySelector('.js-finish-subject').replaceChildren(
    el('span', { className: 'c-auth-code' }, groupedCode(item.transactionNumber)),
    ...beneficiaryLine(item),
  );
  dialog.querySelector('.js-finish-deadline').replaceChildren(deadlinePanel(item, { mode, compact: true }));
  dialog.querySelector('.js-finish-details').replaceChildren(
    fact('Procedimento', item.authorizationTypeName, { wide: true }),
    mode === 'finish'
      ? fact('Solicitada em', formatDate(item.requestDate))
      : fact('Finalizada em', item.finishDate ? formatDate(item.finishDate) : 'Data não registrada'),
    fact('Status atual', item.authorizationStatusName),
  );
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
 * @param {{ onFinish?: (item: object) => void }} [options] com onFinish, o rodapé oferece finalizar as abertas
 * @returns {{ open: (item: object, opener: HTMLElement) => void }}
 */
export function initAuthorizationDetailDialog(dialog, { onFinish } = {}) {
  const code = dialog.querySelector('.js-detail-code');
  const status = dialog.querySelector('.js-detail-status');
  const subtitle = dialog.querySelector('.js-detail-subtitle');
  const deadline = dialog.querySelector('.js-detail-deadline');
  const details = dialog.querySelector('.js-detail-list');
  const finishButton = dialog.querySelector('.js-detail-finish');
  const documentsSection = dialog.querySelector('.js-documents');
  const documentsCount = dialog.querySelector('.js-documents-count');
  const documentsArea = dialog.querySelector('.js-documents-area');
  const closeButton = dialog.querySelector('.js-detail-close');
  const messageSection = dialog.querySelector('.js-beneficiary-message');
  const messageText = dialog.querySelector('.js-message-text');
  const addButton = dialog.querySelector('.js-documents-add');
  const uploadPanel = dialog.querySelector('.js-documents-upload');
  const sendButton = uploadPanel.querySelector('.js-documents-send');
  const uploadStatus = uploadPanel.querySelector('.js-documents-status');

  let uploading = false; // antes do initFileUpload: ele já chama o onChange ao iniciar
  const upload = initFileUpload(uploadPanel.querySelector('.js-upload'), {
    onChange(files) {
      if (!uploading) sendButton.disabled = files.length === 0;
    },
  });

  let current = null;
  let opener = null;
  let controller = null;
  let documentsById = new Map();
  let pointerDownOnBackdrop = false;

  // ── Renderização ───────────────────────────────────────────

  function renderDetails(item) {
    code.replaceChildren(...groupedCode(item.transactionNumber));
    status.replaceChildren(statusBadge(item.authorizationStatusName));
    subtitle.replaceChildren(...beneficiaryLine(item));
    deadline.replaceChildren(deadlinePanel(item));

    const isDone = deadlineLevel(item) === 'done';
    details.replaceChildren(
      fact('Procedimento', item.authorizationTypeName, { wide: true }),
      // Solicitação e finalização já aparecem na régua do prazo; só sem data de finalização não há régua
      ...(isDone && !item.finishDate ? [fact('Solicitada em', formatDate(item.requestDate))] : []),
      fact('Cadastrada em', formatDateTime(item.createdAt), { note: item.insertedByName ? `por ${item.insertedByName}` : undefined }),
    );

    finishButton.hidden = !onFinish || isDone;

    // Mensagem só faz sentido depois de finalizada: em análise não há o que comunicar
    messageSection.hidden = !isDone;
    messageText.textContent = isDone ? beneficiaryMessage(item) : '';
  }

  // ── Inserir documentos ─────────────────────────────────────

  // Só em andamento (o backend recusa finalizada) e com espaço no limite; sem a lista carregada, escondido
  function renderAddButton() {
    const remaining = MAX_FILES - documentsById.size;
    addButton.hidden = !current || deadlineLevel(current) === 'done' || remaining <= 0;
    upload.setMaxFiles(Math.max(remaining, 0));
  }

  function toggleUpload(open) {
    uploadPanel.hidden = !open;
    addButton.setAttribute('aria-expanded', String(open));
    if (!open) {
      upload.clear();
      uploadStatus.textContent = '';
    }
  }

  function resetUpload() {
    toggleUpload(false);
    addButton.hidden = true;
  }

  function setUploading(isBusy) {
    uploading = isBusy;
    upload.setDisabled(isBusy);
    sendButton.disabled = isBusy || upload.getFiles().length === 0;
    sendButton.classList.toggle('is-loading', isBusy);
    uploadPanel.querySelector('.js-documents-cancel').disabled = isBusy;
    uploadStatus.textContent = isBusy ? 'Enviando documentos…' : '';
  }

  async function sendDocuments() {
    const files = upload.getFiles();
    if (uploading || files.length === 0) return;

    const item = current;
    const body = new FormData();
    files.forEach((file) => body.append('files', file));

    setUploading(true);
    try {
      const created = await api.post(`api/authorization-requests/${encodeURIComponent(item.id)}/documents`, body);
      notify.success(created.length === 1 ? '1 documento inserido.' : `${created.length} documentos inseridos.`);
      setUploading(false);

      // Modal fechado ou outra autorização aberta durante o envio: a lista não é desta
      if (current?.id !== item.id) return;
      // Por id: se a lista foi recarregada durante o envio, os novos já podem estar nela
      const merged = new Map(documentsById);
      created.forEach((doc) => merged.set(doc.id, doc));
      renderDocuments([...merged.values()]);
      toggleUpload(false);
      addButton.focus();
    } catch (error) {
      setUploading(false);
      handleError(error); // mantém os arquivos para tentar de novo
    }
  }

  function renderDocumentsLoading() {
    documentsSection.setAttribute('aria-busy', 'true');
    documentsCount.textContent = '';
    addButton.hidden = true;
    const list = el('ul', { className: 'c-document-list' });
    for (let i = 0; i < SKELETON_DOCUMENTS; i++) list.append(documentSkeleton());
    documentsArea.replaceChildren(list);
  }

  function renderDocuments(documents) {
    documentsSection.removeAttribute('aria-busy');
    documentsById = new Map(documents.map((doc) => [doc.id, doc]));
    documentsCount.textContent = String(documents.length);
    renderAddButton();

    if (documents.length === 0) {
      documentsArea.replaceChildren(compactState({
        icon: 'file-text',
        title: 'Nenhum documento anexado',
        text: addButton.hidden
          ? 'Esta autorização não tem documentos enviados.'
          : 'Use Inserir documentos para anexar PDF, JPG ou PNG.',
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

  // Abre o painel e já leva o foco para a escolha de arquivos; clicar de novo fecha
  addButton.addEventListener('click', () => {
    const open = uploadPanel.hidden;
    toggleUpload(open);
    if (open) uploadPanel.querySelector('.js-upload-input').focus();
  });

  uploadPanel.querySelector('.js-documents-cancel').addEventListener('click', () => {
    toggleUpload(false);
    addButton.focus();
  });

  sendButton.addEventListener('click', sendDocuments);

  // Clipboard exige contexto seguro (HTTPS/localhost); se falhar, o texto tem user-select: all
  messageSection.querySelector('.js-copy-message').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(messageText.textContent);
      notify.success('Mensagem copiada.');
    } catch {
      notify.error('Não foi possível copiar. Selecione o texto e copie manualmente.');
    }
  });

  // Idempotente: roda no clique de fechar, no Esc (cancel) e, por garantia, no evento close.
  // Não depender só do close: ele é assíncrono e pode atrasar (ex.: aba em segundo plano).
  function finishClosing() {
    if (!current) return;
    controller?.abort();
    current = null;
    if (!uploading) resetUpload(); // envio em andamento termina sozinho; o painel é resetado no próximo open
    const target = opener;
    opener = null;
    // Firefox/Safari não focam o botão no clique, então a restauração nativa não basta
    target?.focus();
  }

  function close() {
    dialog.close();
    finishClosing();
  }

  // Finalizar daqui: fecha o detalhe e segue o mesmo fluxo de confirmação da linha
  finishButton.addEventListener('click', () => {
    const item = current;
    close();
    onFinish?.(item);
  });

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
      if (uploading) setUploading(false); // envio da autorização anterior: o resultado será ignorado
      resetUpload();
      documentsById = new Map();
      renderDetails(item);
      dialog.showModal();
      closeButton.focus();
      loadDocuments();
    },
  };
}
