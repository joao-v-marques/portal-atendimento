export const PAGE_SIZE = 25;

const numberFormatter = new Intl.NumberFormat('pt-BR');

/**
 * Recorta a página atual (paginação no cliente enquanto a API não pagina).
 * @param {object[]} items
 * @param {number} page página pedida (é ajustada se passar dos limites)
 */
export function paginate(items, page) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * PAGE_SIZE;
  const pageItems = items.slice(start, start + PAGE_SIZE);

  return { pageItems, page: current, totalPages, total, from: start + 1, to: start + pageItems.length };
}

/**
 * @param {HTMLElement} root
 * @param {{ onChange: (page: number) => void }} callbacks
 */
export function initPagination(root, { onChange }) {
  const summary = root.querySelector('.js-page-summary');
  const label = root.querySelector('.js-page-label');
  const previous = root.querySelector('.js-page-previous');
  const next = root.querySelector('.js-page-next');
  let current = 1;

  previous.addEventListener('click', () => onChange(current - 1));
  next.addEventListener('click', () => onChange(current + 1));

  return {
    /** @param {ReturnType<typeof paginate> | null} info null esconde a paginação */
    render(info) {
      if (!info || info.totalPages <= 1) {
        root.hidden = true;
        return;
      }
      current = info.page;
      root.hidden = false;
      summary.textContent = `Mostrando ${numberFormatter.format(info.from)}–${numberFormatter.format(info.to)} de ${numberFormatter.format(info.total)}`;
      label.textContent = `Página ${info.page} de ${info.totalPages}`;
      previous.disabled = info.page === 1;
      next.disabled = info.page === info.totalPages;
    },
  };
}
