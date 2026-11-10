import { el } from '../core/dom.js';
import { deadlineLimitText } from './authorization-table.js';

// Combobox de procedimentos (padrão ARIA 1.2 "combobox com listbox"):
// a pessoa digita o código ou palavras do nome e escolhe na lista. Com milhares de
// tipos, um <select> é impraticável; aqui a busca roda local sobre a lista já carregada.

const MAX_RESULTS = 50;
const MAX_RECENT = 5;
const RECENT_KEY = 'portal:procedimentos-recentes';
const CODE_LENGTH = 8;

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/** Minúsculas e sem acento: "Cirurgião" e "cirurgiao" casam. */
function normalize(text) {
  return String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Versão normalizada do texto + posição original de cada caractere normalizado,
 * para destacar o trecho encontrado no texto como ele é exibido.
 */
function normalizeWithMap(text) {
  let normalized = '';
  const map = [];
  [...text].forEach((char, index) => {
    const piece = normalize(char);
    for (let i = 0; i < piece.length; i++) map.push(index);
    normalized += piece;
  });
  return { normalized, map, chars: [...text] };
}

/** "10.10.101-2" ou "10101012" viram dígitos; texto livre vira palavras. */
function parseQuery(query) {
  const trimmed = query.trim();
  if (/^[\d.\-\s]+$/.test(trimmed)) return { digits: trimmed.replace(/\D/g, ''), words: [] };
  return { digits: '', words: normalize(trimmed).split(/\s+/).filter(Boolean) };
}

function readRecent() {
  try {
    const ids = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(ids) ? ids.map(Number).filter(Number.isInteger) : [];
  } catch {
    return [];
  }
}

function saveRecent(id) {
  try {
    const ids = [id, ...readRecent().filter((item) => item !== id)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids));
  } catch {
    // Sem armazenamento (aba privada, bloqueio): só não lembra os recentes
  }
}

/**
 * Texto com os trechos encontrados em <mark>. Só textContent, nunca innerHTML.
 * @param {string} text
 * @param {string[]} words palavras já normalizadas
 */
function highlighted(text, words) {
  if (!words.length) return [text];
  const { normalized, map, chars } = normalizeWithMap(text);
  const marked = new Array(chars.length).fill(false);
  for (const word of words) {
    let from = normalized.indexOf(word);
    while (from !== -1) {
      for (let i = from; i < from + word.length; i++) marked[map[i]] = true;
      from = normalized.indexOf(word, from + word.length);
    }
  }

  const nodes = [];
  let buffer = '';
  let isMark = false;
  const flush = () => {
    if (!buffer) return;
    nodes.push(isMark ? el('mark', { className: 'c-combobox__match', text: buffer }) : buffer);
    buffer = '';
  };
  chars.forEach((char, index) => {
    if (marked[index] !== isMark) {
      flush();
      isMark = marked[index];
    }
    buffer += char;
  });
  flush();
  return nodes;
}

/**
 * @param {HTMLElement} root elemento .js-procedure-combobox
 * @param {{ onChange?: (item: object | null, info: { byUser: boolean }) => void }} [options]
 */
export function initProcedureCombobox(root, { onChange } = {}) {
  const input = root.querySelector('.js-combobox-input');
  const listbox = root.querySelector('.js-combobox-listbox');
  const clearButton = root.querySelector('.js-combobox-clear');
  const codeChip = root.querySelector('.js-combobox-code');
  const status = root.querySelector('.js-combobox-status');

  let items = [];
  let byId = new Map();
  let selected = null;
  let visible = []; // itens renderizados como opção, na ordem da lista
  let activeIndex = -1;

  // ── Busca ──────────────────────────────────────────────────

  function search(query) {
    const { digits, words } = parseQuery(query);
    if (!digits && !words.length) return { results: [], total: 0, words };

    const matches = [];
    for (const item of items) {
      let rank;
      if (digits) {
        if (!item.code.startsWith(digits)) continue;
        rank = 0;
      } else {
        // Toda palavra precisa aparecer no nome ou no começo do código, em qualquer ordem
        if (!words.every((word) => item.search.includes(word) || item.code.startsWith(word))) continue;
        const first = words[0];
        if (item.search.startsWith(first)) rank = 0;
        else if (item.search.includes(` ${first}`)) rank = 1;
        else rank = 2;
      }
      matches.push({ item, rank });
    }

    matches.sort((a, b) => a.rank - b.rank
      || (digits ? a.item.code.localeCompare(b.item.code) : collator.compare(a.item.name, b.item.name)));
    return { results: matches.slice(0, MAX_RESULTS).map((match) => match.item), total: matches.length, words };
  }

  // ── Renderização ───────────────────────────────────────────

  function option(item, index, words) {
    const { digits } = parseQuery(input.value);
    const code = digits && item.code.startsWith(digits)
      ? [el('mark', { className: 'c-combobox__match', text: digits }), item.code.slice(digits.length)]
      : [item.code];
    const deadline = deadlineLimitText(item.maxDays);

    return el('li', {
      className: 'c-combobox__option',
      attrs: {
        id: `${listbox.id}-${item.id}`,
        role: 'option',
        'aria-selected': String(selected?.id === item.id),
        'data-index': String(index),
      },
    }, [
      el('span', { className: 'c-combobox__code' }, code),
      el('span', { className: 'c-combobox__name', attrs: { title: item.name } }, highlighted(item.name, words)),
      el('span', {
        className: `c-combobox__deadline${item.maxDays === 0 ? ' c-combobox__deadline--now' : ''}`,
        text: deadline,
        attrs: { title: `Prazo da ANS: ${deadline.toLowerCase()}` },
      }),
    ]);
  }

  function message(text) {
    return el('li', { className: 'c-combobox__message', text, attrs: { role: 'presentation' } });
  }

  function render() {
    const query = input.value;
    const nodes = [];
    let announcement;

    if (!query.trim()) {
      visible = readRecent().map((id) => byId.get(id)).filter(Boolean);
      if (visible.length) {
        nodes.push(el('li', { className: 'c-combobox__group', text: 'Usados recentemente', attrs: { role: 'presentation' } }));
        nodes.push(...visible.map((item, index) => option(item, index, [])));
        announcement = `${visible.length} usados recentemente. Digite para buscar outros.`;
      } else {
        nodes.push(message('Digite o código ou parte do nome do procedimento.'));
        announcement = '';
      }
    } else {
      const { results, total, words } = search(query);
      visible = results;
      if (!total) {
        nodes.push(message(`Nenhum procedimento encontrado para “${query.trim()}”. Confira o código ou tente outra palavra do nome.`));
        announcement = 'Nenhum procedimento encontrado.';
      } else {
        nodes.push(...results.map((item, index) => option(item, index, words)));
        if (total > results.length) {
          const count = total.toLocaleString('pt-BR');
          nodes.push(message(`Mostrando ${results.length} de ${count}. Digite mais para refinar.`));
        }
        announcement = `${total.toLocaleString('pt-BR')} ${total === 1 ? 'procedimento encontrado' : 'procedimentos encontrados'}.`;
      }
    }

    listbox.replaceChildren(...nodes);
    status.textContent = announcement;
    // Com busca digitada, a primeira opção já fica ativa: Enter escolhe o melhor resultado
    setActive(query.trim() && visible.length ? 0 : -1);
  }

  function setActive(index) {
    listbox.querySelector('[data-active]')?.removeAttribute('data-active');
    activeIndex = index;
    if (index < 0) {
      input.removeAttribute('aria-activedescendant');
      return;
    }
    const node = listbox.querySelector(`[data-index="${index}"]`);
    node.setAttribute('data-active', '');
    input.setAttribute('aria-activedescendant', node.id);
    node.scrollIntoView({ block: 'nearest' });
  }

  // ── Abrir, fechar, escolher ────────────────────────────────

  function isOpen() {
    return !listbox.hidden;
  }

  function open() {
    if (input.disabled) return;
    render();
    listbox.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function close() {
    listbox.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    activeIndex = -1;
  }

  function showSelection() {
    root.toggleAttribute('data-selected', Boolean(selected));
    codeChip.textContent = selected?.code ?? '';
    clearButton.hidden = !selected && !input.value;
  }

  function choose(item, { remember = true } = {}) {
    selected = item;
    input.value = item?.name ?? '';
    input.title = item?.name ?? ''; // nome longo cortado no campo: inteiro ao passar o mouse
    if (item && remember) saveRecent(item.id);
    showSelection();
    onChange?.(item, { byUser: remember });
  }

  // Digitar sobre uma escolha desfaz a escolha: o valor nunca diverge do texto exibido
  function handleInput() {
    if (selected) {
      selected = null;
      input.title = '';
      root.removeAttribute('data-selected');
      codeChip.textContent = '';
      onChange?.(null, { byUser: true });
    }
    clearButton.hidden = !input.value;
    if (isOpen()) render();
    else open();
  }

  // Código completo digitado (com ou sem pontuação) dispensa escolher na lista
  function exactCodeMatch() {
    const { digits } = parseQuery(input.value);
    if (digits.length !== CODE_LENGTH) return null;
    return items.find((item) => item.code === digits) ?? null;
  }

  function moveActive(step) {
    if (!visible.length) return;
    const next = activeIndex < 0
      ? (step > 0 ? 0 : visible.length - 1)
      : (activeIndex + step + visible.length) % visible.length;
    setActive(next);
  }

  function handleKeydown(event) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen()) open();
        else moveActive(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!isOpen()) open();
        else moveActive(-1);
        break;
      case 'Enter': {
        if (!isOpen()) return; // fechado: Enter envia o formulário normalmente
        event.preventDefault();
        const item = activeIndex >= 0 ? visible[activeIndex] : exactCodeMatch();
        if (item) {
          choose(item);
          close();
        }
        break;
      }
      case 'Escape':
        if (isOpen()) {
          event.preventDefault();
          close();
        } else if (input.value) {
          event.preventDefault();
          choose(null);
        }
        break;
      case 'Tab':
        if (!selected) {
          const item = exactCodeMatch();
          if (item) choose(item);
        }
        close();
        break;
      default:
    }
  }

  input.addEventListener('input', handleInput);
  input.addEventListener('keydown', handleKeydown);
  input.addEventListener('click', () => {
    if (!isOpen()) open();
  });
  input.addEventListener('focus', () => {
    // Ao voltar para um campo já escolhido, seleciona o texto: digitar substitui de uma vez
    if (selected) input.select();
  });

  // mousedown não tira o foco do input; o clique escolhe
  listbox.addEventListener('mousedown', (event) => event.preventDefault());
  listbox.addEventListener('click', (event) => {
    const node = event.target.closest('[role="option"]');
    if (!node) return;
    choose(visible[Number(node.dataset.index)]);
    close();
  });
  listbox.addEventListener('mousemove', (event) => {
    const node = event.target.closest('[role="option"]');
    if (node && Number(node.dataset.index) !== activeIndex) setActive(Number(node.dataset.index));
  });

  clearButton.addEventListener('click', () => {
    choose(null);
    input.focus();
    open();
  });

  // Saiu do campo (clique fora): fecha; código exato digitado vale como escolha
  root.addEventListener('focusout', (event) => {
    if (root.contains(event.relatedTarget)) return;
    if (!selected) {
      const item = exactCodeMatch();
      if (item) choose(item);
    }
    close();
  });

  return {
    /** @param {{ id: number, code: string, name: string, maxDays: number }[]} list */
    setItems(list) {
      items = list.map((item) => ({ ...item, code: String(item.code ?? ''), search: normalize(item.name) }));
      byId = new Map(items.map((item) => [item.id, item]));
      input.disabled = false;
      input.placeholder = 'Busque pelo código ou nome';
    },
    setUnavailable() {
      items = [];
      byId = new Map();
      choose(null, { remember: false });
      input.disabled = true;
      input.placeholder = 'Não foi possível carregar';
    },
    /** @param {number} id */
    select(id) {
      choose(byId.get(id) ?? null, { remember: false });
    },
    clear() {
      choose(null, { remember: false });
      close();
    },
    /** @returns {object | null} */
    get selected() {
      return selected;
    },
    get count() {
      return items.length;
    },
  };
}
