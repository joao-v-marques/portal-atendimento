/** Aba que mostra todas as seções do painel */
const ALL_TAB = 'resumo';

/**
 * Abas que filtram um único painel: cada seção do painel tem `data-tab="<chave>"` e a aba
 * "resumo" mostra todas. Padrão WAI-ARIA Tabs: setas/Home/End trocam de aba (ativação
 * automática), só a aba ativa entra no Tab (roving tabindex).
 *
 * Marcação esperada:
 *   <div class="c-tabs js-tabs"><div role="tablist">
 *     <button role="tab" id="..." data-tab-key="resumo" aria-controls="painel">…</button>
 *   </div></div>
 *   <div role="tabpanel" id="painel"> … <section data-tab="solicitante">…</section> … </div>
 *
 * @param {HTMLElement} root elemento com o tablist
 * @param {{ onChange?: (key: string) => void }} [options]
 * @returns {{ select: (key: string, options?: { focus?: boolean }) => void, reset: () => void, markInvalid: (keys: string[]) => void }}
 */
export function initTabs(root, { onChange } = {}) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const panel = document.getElementById(tabs[0].getAttribute('aria-controls'));
  const sections = [...panel.querySelectorAll('[data-tab]')];

  function select(key, { focus = false } = {}) {
    const active = tabs.find((tab) => tab.dataset.tabKey === key) ?? tabs[0];

    tabs.forEach((tab) => {
      const selected = tab === active;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', active.id);

    const activeKey = active.dataset.tabKey;
    sections.forEach((section) => {
      section.hidden = activeKey !== ALL_TAB && section.dataset.tab !== activeKey;
    });
    panel.dataset.activeTab = activeKey; // o CSS do resumo usa para montar a grade
    panel.scrollTop = 0;

    if (focus) active.focus();
    onChange?.(activeKey);
  }

  root.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) select(tab.dataset.tabKey);
  });

  root.addEventListener('keydown', (event) => {
    const index = tabs.indexOf(event.target);
    if (index < 0) return;

    const next = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    if (next === undefined) return;

    event.preventDefault();
    select(tabs[next].dataset.tabKey, { focus: true });
  });

  return {
    select,

    /** Volta para a primeira aba e limpa as marcas de erro (ao abrir o modal) */
    reset() {
      this.markInvalid([]);
      select(tabs[0].dataset.tabKey);
    },

    /** Indica nas abas quais categorias têm campos com erro */
    markInvalid(keys) {
      tabs.forEach((tab) => {
        const invalid = keys.includes(tab.dataset.tabKey);
        tab.classList.toggle('c-tabs__tab--invalid', invalid);
        tab.querySelector('.js-tab-invalid')?.toggleAttribute('hidden', !invalid);
      });
    },
  };
}
