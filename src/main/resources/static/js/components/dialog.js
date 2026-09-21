/**
 * Ciclo de vida de um <dialog> modal: Esc, backdrop e devolução do foco.
 *
 * Mesmo comportamento já resolvido no authorization-detail-dialog.js, aqui como
 * componente porque a tela de configurações tem três diálogos.
 *
 * @param {HTMLDialogElement} dialog
 * @param {{
 *   closeOnBackdrop?: boolean,
 *   onClose?: () => void,
 *   dismissSelector?: string,
 * }} [options] closeOnBackdrop fica false em formulário: clique fora não deve descartar digitação
 * @returns {{ open: (opener?: HTMLElement | null) => void, close: () => void, isOpen: () => boolean }}
 */
export function initDialog(dialog, { closeOnBackdrop = true, onClose, dismissSelector = '.js-dialog-dismiss' } = {}) {
  let isOpen = false;
  let opener = null;
  let pointerDownOnBackdrop = false;

  // Idempotente: roda no clique de fechar, no Esc (cancel) e, por garantia, no close.
  // Não depender só do close: ele é assíncrono e pode atrasar (ex.: aba em segundo plano).
  function finishClosing() {
    if (!isOpen) return;
    isOpen = false;
    const target = opener;
    opener = null;
    onClose?.();
    // Firefox/Safari não focam o botão no clique, então a restauração nativa não basta
    target?.focus();
  }

  function close() {
    dialog.close();
    finishClosing();
  }

  dialog.querySelectorAll(dismissSelector).forEach((button) => {
    button.addEventListener('click', close);
  });

  if (closeOnBackdrop) {
    // Fecha no backdrop só se o clique começou nele (arrastar seleção de texto para fora não fecha)
    dialog.addEventListener('pointerdown', (event) => {
      pointerDownOnBackdrop = event.target === dialog;
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog && pointerDownOnBackdrop) close();
    });
  }

  // Esc: assume o fechamento. No cancel o fundo ainda está inerte e o foco não voltaria ao opener
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('close', finishClosing);

  return {
    open(openerElement = null) {
      opener = openerElement;
      isOpen = true;
      dialog.showModal();
    },
    close,
    isOpen: () => isOpen,
  };
}
