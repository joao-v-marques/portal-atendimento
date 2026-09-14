/**
 * Cria um elemento com segurança: textos sempre via textContent, nunca innerHTML.
 * @param {string} tag
 * @param {{ className?: string, text?: string, attrs?: Record<string, string> }} [options]
 * @param {(Node | string)[]} [children]
 */
export function el(tag, { className, text, attrs = {} } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  node.append(...children);
  return node;
}

/**
 * @template {(...args: any[]) => void} T
 * @param {T} fn
 * @param {number} [wait]
 */
export function debounce(fn, wait = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/**
 * Entrega um Blob ao usuário como arquivo baixado.
 * @param {Blob} blob
 * @param {string} filename
 */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = el('a', { attrs: { href: url, download: filename } });
  document.body.append(link);
  link.click();
  link.remove();
  // Revogar no próximo ciclo: alguns navegadores ainda leem a URL logo após o click
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
