import { el } from '../core/dom.js';
import { businessDaysSince, formatDate } from '../core/format.js';
import {
  DEFAULT_DEADLINE_BUSINESS_DAYS,
  businessDaysLabel,
  deadlineLevel,
  finishLead,
  finishLeadText,
} from './authorization-table.js';

// Régua do prazo da ANS: um segmento por dia útil do prazo do tipo, preenchido até hoje
// (ou até a finalização). Usada no Detalhes e nas confirmações de Finalizar/Reabrir.

const MAX_SEGMENTS = 30; // acima disso os segmentos ficariam finos demais: vira barra contínua

function toIso(date) {
  return date.toLocaleDateString('en-CA'); // "AAAA-MM-DD" no fuso do navegador
}

/**
 * Data "AAAA-MM-DD" somada de n dias úteis (seg–sex, sem feriados), mesma regra de businessDaysSince.
 * @param {string} isoDate
 * @param {number} days
 */
export function addBusinessDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  let left = days;
  while (left > 0) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) left--;
  }
  return toIso(date);
}

/**
 * Resumo do prazo para exibir. Mesmas regras de deadlineLevel/finishLead (authorization-table.js).
 * @param {object} item autorização
 * @param {{ mode?: 'detail' | 'finish' | 'reopen' }} [options]
 *   finish: prevê o resultado se for finalizada hoje; reopen: mostra a contagem como se voltasse a ficar aberta
 */
export function deadlineSummary(item, { mode = 'detail' } = {}) {
  const maxDays = item.authorizationTypeMaxDays ?? DEFAULT_DEADLINE_BUSINESS_DAYS;
  const limit = Math.max(maxDays, 1); // imediato (0) = só o dia da solicitação
  const lastDay = item.requestDate ? addBusinessDays(item.requestDate, limit - 1) : null;
  const base = { maxDays, limit, lastDay };

  const isDone = mode === 'detail' && deadlineLevel(item) === 'done';

  if (isDone) {
    const lead = finishLead(item);
    if (!lead) {
      return { ...base, tone: 'done', used: null, headline: 'Finalizada', caption: 'A data de finalização não foi registrada.' };
    }
    return {
      ...base,
      tone: lead.early < 0 ? 'late' : 'done',
      used: lead.used,
      headline: lead.early === 0 ? 'Finalizada no último dia do prazo' : `Finalizada com ${finishLeadText(lead)}`,
      endLabel: `Finalizada em ${formatDate(item.finishDate)}`,
    };
  }

  const used = businessDaysSince(item.requestDate) ?? 0;

  if (mode === 'finish') {
    const early = maxDays - used; // mesma conta de finishLead, com a finalização hoje
    return {
      ...base,
      tone: early < 0 ? 'late' : 'done',
      used,
      headline: early === 0
        ? 'Será finalizada no último dia do prazo'
        : `Será finalizada com ${finishLeadText({ early })}`,
      endLabel: `Último dia: ${formatDate(lastDay)}`,
    };
  }

  // Aberta (ou prévia de reabrir): mesma classificação dos cards e da tabela
  const level = deadlineLevel({ ...item, authorizationStatusName: 'Em análise' });
  const remaining = limit - used;
  let headline;
  if (remaining > 1) headline = `Faltam ${businessDaysLabel(remaining)}`;
  else if (remaining === 1) headline = maxDays === 0 ? 'Atendimento imediato: prazo é hoje' : 'Hoje é o último dia do prazo';
  else if (remaining === 0) headline = 'Prazo venceu hoje';
  else headline = `Vencida há ${businessDaysLabel(-remaining)}`;

  return {
    ...base,
    tone: level === 'overdue' ? 'late' : level,
    used,
    headline,
    caption: mode === 'reopen' ? 'Ao reabrir, a contagem continua a partir da data da solicitação.' : null,
    endLabel: `Último dia: ${formatDate(lastDay)}`,
  };
}

function track(summary) {
  const { limit, used, tone } = summary;
  const filled = Math.min(used, limit);
  const overflow = used - limit; // dias úteis desde que venceu: mesmo número do "Vencida há N"
  const label = `Dia útil ${used} de ${limit} do prazo`;

  if (limit > MAX_SEGMENTS) {
    return el('div', { className: `c-deadline__track c-deadline__track--bar c-deadline__track--${tone}`, attrs: { role: 'img', 'aria-label': label } }, [
      el('span', { className: 'c-deadline__fill', attrs: { style: `inline-size: ${Math.min((used / limit) * 100, 100)}%` } }),
    ]);
  }

  const segments = [];
  for (let i = 0; i < limit; i++) {
    let state = 'empty';
    if (i < filled) state = 'past';
    else if (i === used) state = 'current';
    segments.push(el('span', { className: `c-deadline__segment c-deadline__segment--${state}` }));
  }

  return el('div', { className: 'c-deadline__track-row' }, [
    el('div', {
      className: `c-deadline__track c-deadline__track--${tone}`,
      attrs: { role: 'img', 'aria-label': label, style: `--segments: ${limit}` },
    }, segments),
    ...(overflow > 0 && tone === 'late'
      ? [el('span', { className: 'c-deadline__overflow', text: `+${overflow}`, attrs: { 'aria-hidden': 'true' } })]
      : []),
  ]);
}

/**
 * Painel do prazo da ANS com a régua de dias úteis.
 * @param {object} item
 * @param {{ mode?: 'detail' | 'finish' | 'reopen', compact?: boolean }} [options]
 */
export function deadlinePanel(item, { mode = 'detail', compact = false } = {}) {
  const summary = deadlineSummary(item, { mode });
  const prazo = summary.maxDays === 0 ? 'imediato' : businessDaysLabel(summary.maxDays);

  const children = [
    el('div', { className: 'c-deadline__heading' }, [
      el('p', { className: 'c-deadline__headline', text: summary.headline }),
      el('p', { className: 'c-deadline__limit', text: `Prazo da ANS: ${prazo}` }),
    ]),
  ];

  if (summary.used !== null) {
    children.push(track(summary));
    children.push(el('div', { className: 'c-deadline__scale' }, [
      el('span', { text: `Solicitada em ${formatDate(item.requestDate)}` }),
      el('span', { text: summary.endLabel }),
    ]));
  }
  if (summary.caption) children.push(el('p', { className: 'c-deadline__caption', text: summary.caption }));

  return el('div', {
    className: `c-deadline c-deadline--${summary.tone}${compact ? ' c-deadline--compact' : ''}`,
  }, children);
}
