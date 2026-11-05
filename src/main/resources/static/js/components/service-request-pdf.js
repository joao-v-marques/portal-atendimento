import { el } from '../core/dom.js';
import { formatDate, formatDateTime, formatPhone } from '../core/format.js';
import { deadlineDateText, deadlineInfo, isFinished } from './service-request-table.js';

// Ficha do atendimento em A4: documento próprio num iframe oculto, impresso pelo navegador
// ("Salvar como PDF"). Os textos entram por textContent (el), nunca como HTML

const STYLES = `
  @font-face {
    font-family: "Inter";
    src: url("css/fonts/inter-variable.woff2") format("woff2");
    font-weight: 100 900;
  }
  @page { size: A4; margin: 14mm 14mm 18mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font: 400 10pt/1.45 "Inter", system-ui, sans-serif; color: #1f2a30; }

  .doc-header {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding-bottom: 14px; border-bottom: 3px solid #00804e;
  }
  .doc-header__logo { height: 44px; width: auto; }
  .doc-header__text { text-align: right; }
  .doc-header__kicker { font-size: 8pt; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: #5b676d; }
  .doc-header__title { font-size: 17pt; font-weight: 700; line-height: 1.2; color: #12301f; }
  .doc-header__title span { color: #00804e; }

  .doc-status { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
  .chip {
    display: inline-block; padding: 3px 10px; border-radius: 999px;
    font-size: 8.5pt; font-weight: 600; background: #eef1f2; color: #3c474d;
  }
  .chip--done { background: #e3f4ec; color: #00663e; }
  .chip--open { background: #fff4dc; color: #8a5a00; }
  .doc-status__deadline { font-size: 9pt; color: #5b676d; }

  .highlights {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 14px;
  }
  .highlight { padding: 9px 11px; border-radius: 8px; background: #f4f7f6; border: 1px solid #e3e8e6; }
  .highlight dt { font-size: 7.5pt; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: #5b676d; }
  .highlight dd { margin-top: 2px; font-weight: 600; color: #1f2a30; }

  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
  .section { break-inside: avoid; border: 1px solid #e3e8e6; border-radius: 8px; overflow: hidden; }
  .section--full { margin-top: 12px; }
  .section__title {
    padding: 7px 12px; font-size: 8.5pt; font-weight: 700; letter-spacing: .05em; text-transform: uppercase;
    color: #00663e; background: #f4f7f6; border-bottom: 1px solid #e3e8e6;
  }
  .section__list { padding: 4px 12px 8px; }
  .row { display: grid; grid-template-columns: 38% 1fr; gap: 8px; padding: 5px 0; border-bottom: 1px dashed #e3e8e6; }
  .row:last-child { border-bottom: 0; }
  .row dt { color: #5b676d; }
  .row dd { font-weight: 500; overflow-wrap: anywhere; }
  .section__text { padding: 10px 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
  .section--resolution { border-left: 4px solid #00804e; }

  .doc-footer {
    display: flex; justify-content: space-between; margin-top: 18px; padding-top: 6px;
    border-top: 1px solid #e3e8e6; font-size: 7.5pt; color: #7a858a;
  }
`;

function text(value) {
  return value == null || value === '' ? '—' : String(value);
}

// "12345678901" → "123.456.789-01"; fora do padrão aparece como veio
function formatCpf(value) {
  const cpf = String(value ?? '');
  return /^\d{11}$/.test(cpf) ? `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}` : cpf;
}

// Mesma frase do selo do prazo na tela; o title tem a versão completa quando existe
function deadlineText(item) {
  const info = deadlineInfo(item);
  return info.getAttribute('title') || info.textContent;
}

function highlight(term, value) {
  return el('div', { className: 'highlight' }, [
    el('dt', { text: term }),
    el('dd', { text: text(value) }),
  ]);
}

function section(title, rows) {
  return el('section', { className: 'section' }, [
    el('h2', { className: 'section__title', text: title }),
    el('dl', { className: 'section__list' }, rows.map(([term, value]) => el('div', { className: 'row' }, [
      el('dt', { text: term }),
      el('dd', { text: text(value) }),
    ]))),
  ]);
}

function textSection(title, value, modifier = '') {
  return el('section', { className: `section section--full ${modifier}` }, [
    el('h2', { className: 'section__title', text: title }),
    el('p', { className: 'section__text', text: text(value) }),
  ]);
}

function buildDocument(item) {
  const finished = isFinished(item);
  const logo = el('img', { className: 'doc-header__logo', attrs: { src: 'css/img/logo-2023.png', alt: 'Unimed S. S. do Paraíso' } });

  return [
    el('header', { className: 'doc-header' }, [
      logo,
      el('div', { className: 'doc-header__text' }, [
        el('p', { className: 'doc-header__kicker', text: 'Ficha de atendimento' }),
        el('h1', { className: 'doc-header__title' }, ['Protocolo ', el('span', { text: text(item.protocolNumber) })]),
      ]),
    ]),

    el('div', { className: 'doc-status' }, [
      el('span', { className: `chip ${finished ? 'chip--done' : 'chip--open'}`, text: text(item.statusName) }),
      el('span', { className: 'doc-status__deadline', text: deadlineText(item) }),
    ]),

    el('dl', { className: 'highlights' }, [
      highlight('Categoria', item.categoryName),
      highlight('Severidade', item.severityName),
      highlight('Aberto em', formatDateTime(item.openedAt)),
      highlight('Prazo final', deadlineDateText(item)),
    ]),

    el('div', { className: 'grid' }, [
      section('Atendimento', [
        ['Protocolo', item.protocolNumber],
        ['Status', item.statusName],
        ['Categoria', item.categoryName],
        ['Canal', item.channelName],
        ['Tipo', item.typeName],
        ['Severidade', item.severityName],
      ]),
      section('Solicitante', [
        ['Nome', item.requesterName],
        ['Carteirinha', item.requesterCardNumber],
        ['CPF', formatCpf(item.requesterCpf)],
        ['Data de nascimento', item.requesterBirthDate ? formatDate(item.requesterBirthDate) : ''],
        ['Telefone', item.requesterPhone ? formatPhone(item.requesterPhone) : ''],
        ['E-mail', item.requesterEmail],
      ]),
      section('Responsável e prazos', [
        ['Responsável', item.assignedToName],
        ['Aberto em', formatDateTime(item.openedAt)],
        ['Prazo final', deadlineDateText(item)],
        ['Finalizado em', item.closedAt ? formatDateTime(item.closedAt) : ''],
        // null: em andamento, ou finalizado antes de a pergunta existir
        ['Resolvido', item.resolved == null ? '' : (item.resolved ? 'Sim' : 'Não')],
      ]),
      section('Histórico', [
        ['Cadastrado por', item.insertedByName],
        ['Cadastrado em', formatDateTime(item.createdAt)],
        ['Atualizado por', item.updatedByName],
        ['Atualizado em', item.updatedAt ? formatDateTime(item.updatedAt) : ''],
      ]),
    ]),

    textSection('Descrição', item.description),
    // Reaberto mantém a resolução anterior até a próxima finalização (regra do backend)
    item.resolution ? textSection('Resolução', item.resolution, 'section--resolution') : '',

    el('footer', { className: 'doc-footer' }, [
      el('span', { text: 'Portal de Atendimento · Unimed S. S. do Paraíso' }),
      el('span', { text: `Gerado em ${formatDateTime(new Date().toISOString())}` }),
    ]),
  ];
}

/**
 * Abre a impressão da ficha do atendimento; o usuário escolhe "Salvar como PDF".
 * @param {object} item atendimento como vem da API (o mesmo do modal de detalhe)
 */
export function printServiceRequest(item) {
  const filename = `atendimento-${item.protocolNumber ?? ''}`;
  const iframe = el('iframe', { attrs: { 'aria-hidden': 'true', tabindex: '-1' } });
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden;';
  // srcdoc herda o endereço da página: o caminho da fonte e do logo resolve igual
  iframe.srcdoc = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${filename.replace(/[<&]/g, '')}</title><style>${STYLES}</style></head><body></body></html>`;

  iframe.addEventListener('load', async () => {
    const doc = iframe.contentDocument;
    doc.body.append(...buildDocument(item));
    // Espera logo e fonte: senão o PDF sai sem eles
    await Promise.all([...doc.images].map((img) => (img.complete ? null : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; }))));
    await doc.fonts.ready;

    // O nome sugerido do PDF vem do título da página principal no Chrome
    const pageTitle = document.title;
    document.title = filename;
    const cleanup = () => {
      document.title = pageTitle;
      iframe.remove();
    };
    iframe.contentWindow.addEventListener('afterprint', () => setTimeout(cleanup, 0), { once: true });
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  }, { once: true });

  document.body.append(iframe);
}
