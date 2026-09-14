/**
 * Menu suspenso acessível (padrão "menu button" da WAI-ARIA).
 *
 * Estrutura esperada dentro de `root`:
 * - `.js-dropdown-trigger`: <button aria-haspopup="menu" aria-expanded aria-controls>
 * - `.js-dropdown-list`: <ul role="menu" hidden> com itens [role="menuitem"][tabindex="-1"]
 * Itens com `data-keep-open` não fecham o menu ao serem clicados (ex.: ação com carregamento).
 *
 * @param {HTMLElement} root
 * @returns {{ open: (focus?: 'first' | 'last') => void, close: (options?: { restoreFocus?: boolean }) => void }}
 */
export function initDropdownMenu(root) {
  const trigger = root.querySelector('.js-dropdown-trigger');
  const list = root.querySelector('.js-dropdown-list');

  const isOpen = () => !list.hidden;
  const enabledItems = () => [...list.querySelectorAll('[role="menuitem"]')].filter((item) => !item.disabled);

  function focusItem(index) {
    const items = enabledItems();
    if (items.length === 0) return;
    // Índice circular: da última opção volta para a primeira e vice-versa
    items[(index + items.length) % items.length].focus();
  }

  function open(focus = 'first') {
    list.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    focusItem(focus === 'last' ? -1 : 0);
  }

  function close({ restoreFocus = true } = {}) {
    if (!isOpen()) return;
    list.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus();
  }

  trigger.addEventListener('click', () => {
    if (isOpen()) close();
    else open();
  });

  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open(event.key === 'ArrowUp' ? 'last' : 'first');
    }
  });

  list.addEventListener('keydown', (event) => {
    const items = enabledItems();
    const current = items.indexOf(document.activeElement);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusItem(current + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusItem(current - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusItem(0);
        break;
      case 'End':
        event.preventDefault();
        focusItem(-1);
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation(); // não fecha junto a gaveta ou um modal que esteja por trás
        close();
        break;
      case 'Tab':
        // Deixa o Tab seguir para o próximo elemento da página
        close({ restoreFocus: false });
        break;
      default:
        break;
    }
  });

  list.addEventListener('click', (event) => {
    const item = event.target.closest('[role="menuitem"]');
    if (item && !item.hasAttribute('data-keep-open')) close();
  });

  // Clique/toque fora fecha sem roubar o foco de onde a pessoa clicou
  document.addEventListener('pointerdown', (event) => {
    if (isOpen() && !root.contains(event.target)) close({ restoreFocus: false });
  });

  return { open, close };
}
