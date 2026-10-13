/**
 * Tema claro/escuro. O atributo data-theme no <html> é aplicado antes da 1ª pintura pelo
 * script inline do <head> (mesma chave e mesma regra daqui); este módulo só troca e salva.
 *
 * Sem escolha salva, segue o sistema (prefers-color-scheme).
 */

// Mesma chave do script inline no <head> dos templates
const STORAGE_KEY = 'theme';

/** @returns {'light' | 'dark'} */
export function getTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** @param {'light' | 'dark'} theme */
export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Armazenamento bloqueado: troca agora, só não lembra na próxima página
  }
}

/** @returns {'light' | 'dark'} o tema aplicado */
export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}
