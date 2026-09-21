/**
 * Confirmação de ação destrutiva (guia 11.8).
 *
 * A resolução vem do clique em cada botão, não do evento `close` + `returnValue`:
 * `close` é assíncrono e, em teste, não chegou a disparar em alguns fechamentos —
 * a ação ficava silenciosamente sem efeito. Mesma precaução do
 * authorization-detail-dialog.js ("não depender só do close").
 *
 * @param {HTMLDialogElement} dialog
 * @returns {{ ask: (options: { title: string, description: string, confirmLabel: string, opener?: HTMLElement | null }) => Promise<boolean> }}
 */
export function initConfirmDialog(dialog) {
  const title = dialog.querySelector('.js-confirm-title');
  const description = dialog.querySelector('.js-confirm-description');
  const confirmButton = dialog.querySelector('.js-confirm-accept');
  const cancelButton = dialog.querySelector('.js-confirm-cancel');

  let settle = null;
  let opener = null;

  // Idempotente: o primeiro caminho a fechar resolve, os outros não fazem nada
  function finish(confirmed) {
    if (!settle) return;
    const resolve = settle;
    settle = null;

    if (dialog.open) dialog.close();

    const target = opener;
    opener = null;
    // O foco volta antes de quem chamou re-renderizar a linha: depois o opener
    // já estaria fora do DOM e o foco cairia no <body>
    target?.focus();

    resolve(confirmed);
  }

  confirmButton.addEventListener('click', () => finish(true));
  cancelButton.addEventListener('click', () => finish(false));

  // Esc: o cancel é assumido aqui para o foco voltar ao opener
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    finish(false);
  });

  // Rede de segurança: fechamento por qualquer outro caminho conta como cancelar
  dialog.addEventListener('close', () => finish(false));

  return {
    ask({ title: titleText, description: descriptionText, confirmLabel, opener: openerElement = null }) {
      title.textContent = titleText;
      description.textContent = descriptionText;
      confirmButton.textContent = confirmLabel;

      return new Promise((resolve) => {
        settle = resolve;
        opener = openerElement;
        dialog.showModal();
        // Foco no botão menos destrutivo (guia 11.7)
        cancelButton.focus();
      });
    },
  };
}
