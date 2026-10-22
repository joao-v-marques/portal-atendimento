export const DEFAULT_SECTION = 'usuarios';

/**
 * Sub-navegação das configurações.
 *
 * Os itens são links de verdade e a troca de seção é uma navegação completa: Voltar,
 * abrir em nova aba e copiar link funcionam sem pushState/popstate — máquina de
 * histórico que o projeto não usa em nenhuma outra tela.
 *
 * @param {HTMLElement} root a <nav> da sub-navegação
 * @param {HTMLElement[]} panels seções do painel, cada uma com data-section
 * @param {string} [defaultSection] seção quando ?secao= falta ou é desconhecida
 * @returns {{ section: string }} a seção realmente ativa
 */
export function initSettingsNav(root, panels, defaultSection = DEFAULT_SECTION) {
  const links = [...root.querySelectorAll('.js-section-link')];
  const known = new Set(links.map((link) => link.dataset.section));

  const requested = new URLSearchParams(window.location.search).get('secao');
  const section = known.has(requested) ? requested : defaultSection;

  // Seção ausente ou desconhecida: normaliza a URL sem Notyf (guia 8.6 não notifica
  // navegação trivial) e sem criar entrada no histórico
  if (requested !== section) {
    const params = new URLSearchParams(window.location.search);
    params.set('secao', section);
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
  }

  for (const link of links) {
    const isActive = link.dataset.section === section;
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  for (const panel of panels) {
    panel.hidden = panel.dataset.section !== section;
  }

  return { section };
}
