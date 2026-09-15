import { el } from '../core/dom.js';
import { fileTypeLabel, formatFileSize } from '../core/format.js';
import { notify } from '../core/notify.js';
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_FILE_TYPES,
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_REQUEST_BYTES,
} from '../core/validators.js';

const numberFormatter = new Intl.NumberFormat('pt-BR');

function extensionOf(name) {
  return String(name).split('.').pop().toLowerCase();
}

// Alguns sistemas mandam o MIME vazio: a extensão serve de reserva. O backend confere a assinatura real.
function isAllowedType(file) {
  return ALLOWED_FILE_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(extensionOf(file.name));
}

function fileKey(file) {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

function contentTypeOf(file) {
  if (ALLOWED_FILE_TYPES.includes(file.type)) return file.type;
  return extensionOf(file.name) === 'pdf' ? 'application/pdf' : `image/${extensionOf(file.name) === 'png' ? 'png' : 'jpeg'}`;
}

function megabytes(bytes) {
  return `${numberFormatter.format(Math.round((bytes / (1024 * 1024)) * 10) / 10)} MB`;
}

/**
 * Seleção de documentos com validação no cliente (tipo, tamanho, quantidade e soma).
 * @param {HTMLElement} root elemento .js-upload
 * @param {{ onChange?: (files: File[]) => void }} [callbacks]
 * @returns {{ getFiles: () => File[], clear: () => void, setDisabled: (disabled: boolean) => void }}
 */
export function initFileUpload(root, { onChange } = {}) {
  const input = root.querySelector('.js-upload-input');
  const dropzone = root.querySelector('.js-upload-dropzone');
  const list = root.querySelector('.js-upload-list');
  const summary = root.querySelector('.js-upload-summary');

  /** @type {File[]} */
  let files = [];
  let disabled = false;

  // ── Renderização ───────────────────────────────────────────

  function totalBytes(items = files) {
    return items.reduce((sum, file) => sum + file.size, 0);
  }

  function renderSummary() {
    // Total usado com a unidade adequada (arquivos pequenos apareceriam como "0 MB")
    const used = files.length === 0 ? '0 MB' : formatFileSize(totalBytes());
    summary.textContent = `${files.length} de ${MAX_FILES} arquivos · ${used} de ${megabytes(MAX_REQUEST_BYTES)}`;
  }

  function renderItem(file, index) {
    const contentType = contentTypeOf(file);
    const isImage = contentType.startsWith('image/');

    return el('li', { className: 'c-document-list__item' }, [
      el('span', { className: 'c-document-list__icon', attrs: { 'aria-hidden': 'true' } }, [
        el('span', { className: `c-icon c-icon--${isImage ? 'file-image' : 'file-text'}` }),
      ]),
      el('div', { className: 'c-document-list__info' }, [
        el('span', { className: 'c-document-list__name', text: file.name, attrs: { title: file.name } }),
        el('span', { className: 'c-document-list__meta', text: `${fileTypeLabel(contentType)} · ${formatFileSize(file.size)}` }),
      ]),
      el('button', {
        className: 'c-icon-button js-upload-remove',
        attrs: {
          type: 'button',
          'data-index': String(index),
          'aria-label': `Remover ${file.name}`,
          title: `Remover ${file.name}`,
        },
      }, [el('span', { className: 'c-icon c-icon--trash', attrs: { 'aria-hidden': 'true' } })]),
    ]);
  }

  function render() {
    const fragment = document.createDocumentFragment();
    files.forEach((file, index) => fragment.append(renderItem(file, index)));
    list.replaceChildren(fragment);
    list.hidden = files.length === 0;
    list.querySelectorAll('.js-upload-remove').forEach((button) => { button.disabled = disabled; });
    renderSummary();
    onChange?.(files);
  }

  // ── Regras ─────────────────────────────────────────────────

  function addFiles(selected) {
    if (disabled) return;

    const accepted = [...files];
    const rejected = [];
    const known = new Set(accepted.map(fileKey));

    for (const file of selected) {
      if (known.has(fileKey(file))) continue; // mesmo arquivo de novo: ignora em silêncio
      if (!isAllowedType(file)) {
        rejected.push(`${file.name} (formato não aceito)`);
      } else if (file.size > MAX_FILE_BYTES) {
        rejected.push(`${file.name} (maior que 10MB)`);
      } else if (accepted.length >= MAX_FILES) {
        rejected.push(`${file.name} (limite de ${MAX_FILES} arquivos)`);
      } else if (totalBytes(accepted) + file.size > MAX_REQUEST_BYTES) {
        rejected.push(`${file.name} (ultrapassa 50MB no total)`);
      } else {
        accepted.push(file);
        known.add(fileKey(file));
      }
    }

    files = accepted;
    render();

    // Uma notificação por ação, resumindo todos os recusados
    if (rejected.length === 1) {
      notify.error(`1 arquivo não foi adicionado: ${rejected[0]}.`);
    } else if (rejected.length > 1) {
      notify.error(`${rejected.length} arquivos não foram adicionados: ${rejected.join(', ')}.`);
    }
  }

  function removeAt(index) {
    if (disabled) return;
    files = files.filter((_, i) => i !== index);
    render();
    // Foco não se perde: vai para o arquivo que ocupou o lugar, o anterior ou a área de envio
    const buttons = list.querySelectorAll('.js-upload-remove');
    (buttons[index] ?? buttons[index - 1] ?? input).focus();
  }

  // ── Eventos ────────────────────────────────────────────────

  input.addEventListener('change', () => {
    addFiles([...input.files]);
    input.value = ''; // permite escolher o mesmo arquivo de novo depois de removê-lo
  });

  list.addEventListener('click', (event) => {
    const button = event.target.closest('.js-upload-remove');
    if (button) removeAt(Number(button.dataset.index));
  });

  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault(); // necessário para o drop acontecer
    if (disabled) {
      event.dataTransfer.dropEffect = 'none';
      return;
    }
    dropzone.classList.add('is-dragover');
  });

  dropzone.addEventListener('dragleave', (event) => {
    if (!dropzone.contains(event.relatedTarget)) dropzone.classList.remove('is-dragover');
  });

  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-dragover');
    addFiles([...(event.dataTransfer?.files ?? [])]);
  });

  // Arquivo solto fora da área: sem isto o navegador abre o arquivo e o formulário preenchido se perde
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', (event) => {
    if (!dropzone.contains(event.target)) event.preventDefault();
  });

  render();

  return {
    getFiles: () => [...files],
    clear() {
      files = [];
      render();
    },
    setDisabled(value) {
      disabled = value;
      input.disabled = value;
      root.classList.toggle('is-disabled', value);
      list.querySelectorAll('.js-upload-remove').forEach((button) => { button.disabled = value; });
    },
  };
}
