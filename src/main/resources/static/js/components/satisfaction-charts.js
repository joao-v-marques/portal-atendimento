/* global Chart -- js/vendor/chart.umd.min.js, carregado com defer antes do módulo da página */

const numberFormatter = new Intl.NumberFormat('pt-BR');
const percentFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const NO_ANSWER = 'Sem resposta';

// Cor de cada nota: tokens de satisfaction-survey.css (mudam com o tema)
const GRADE_TOKENS = {
  1: '--grade-1',
  2: '--grade-2',
  3: '--grade-3',
  4: '--grade-4',
  5: '--grade-5',
  [NO_ANSWER]: '--grade-none',
};

function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Lido a cada montagem: o tema pode ter mudado desde a última
function readColors() {
  return {
    grade: (grade) => token(GRADE_TOKENS[grade] ?? '--grade-none'),
    line: token('--color-primary'),
    lineFill: token('--color-primary-subtle'),
    surface: token('--color-surface'),
    text: token('--color-text-secondary'),
    strongText: token('--color-text'),
    grid: token('--color-border'),
    font: token('--font-body') || 'sans-serif',
  };
}

function gradeLabel(grade) {
  return grade === NO_ANSWER ? NO_ANSWER : `Nota ${grade}`;
}

function share(count, total) {
  return total > 0 ? count / total : 0;
}

// ── Rótulos de valor ─────────────────────────────────────────

// O Chart.js não desenha o valor sobre a barra/ponto; este plugin faz isso (como no Excel)
const valueLabels = {
  id: 'valueLabels',
  afterDatasetsDraw(chart, _args, options) {
    if (!options.formatter) return;
    const { ctx } = chart;
    ctx.save();
    ctx.font = `600 12px ${options.font}`;
    ctx.fillStyle = options.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) return;
      meta.data.forEach((element, index) => {
        ctx.fillText(options.formatter(dataset.data[index], index), element.x, element.y - 6);
      });
    });
    ctx.restore();
  },
};

// ── Opções comuns ────────────────────────────────────────────

function baseOptions(colors, { stacked = false, percent = false, labels } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false, // a altura vem do .c-chart-card__canvas
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { top: labels ? 8 : 0 } },
    plugins: {
      legend: {
        display: stacked,
        position: 'bottom',
        labels: { color: colors.text, usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 10, boxHeight: 10, padding: 16 },
      },
      tooltip: {
        backgroundColor: colors.strongText,
        titleColor: colors.surface,
        bodyColor: colors.surface,
        padding: 10,
        cornerRadius: 6,
        boxPadding: 4,
        // Empilhado: esconde as notas zeradas daquele grupo para o tooltip não ficar enorme
        filter: (item) => !stacked || item.raw > 0,
      },
      valueLabels: labels ? { ...labels, color: colors.strongText, font: colors.font } : {},
    },
    scales: {
      x: {
        stacked,
        grid: { display: false },
        border: { color: colors.grid },
        ticks: { color: colors.text, maxRotation: 0, autoSkip: true },
      },
      y: {
        stacked,
        beginAtZero: true,
        grace: labels ? '12%' : 0, // espaço para o rótulo da barra mais alta
        grid: { color: colors.grid },
        border: { display: false },
        ticks: {
          color: colors.text,
          precision: percent ? undefined : 0,
          callback: (value) => (percent ? percentFormatter.format(value) : numberFormatter.format(value)),
        },
      },
    },
  };
}

// ── Gráficos ─────────────────────────────────────────────────

/** Barras empilhadas por nota (por horário e por dia da semana) */
function stackedByGrade(canvas, colors, grades, series, labelFor) {
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: series.map((item) => labelFor(item.label)),
      datasets: grades.map((grade) => ({
        label: gradeLabel(grade),
        data: series.map((item) => item.grades[grade] ?? 0),
        backgroundColor: colors.grade(grade),
        borderColor: colors.surface, // separa os blocos da pilha
        borderWidth: { top: 1 },
        borderSkipped: false,
        maxBarThickness: 40,
      })),
    },
    options: baseOptions(colors, { stacked: true }),
  });
}

/** Barras com o percentual de cada nota (geral e válidas) */
function gradeShare(canvas, colors, items) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const options = baseOptions(colors, {
    percent: true,
    labels: { formatter: (value) => percentFormatter.format(value) },
  });
  options.plugins.tooltip.callbacks = {
    label: (context) => {
      const count = items[context.dataIndex].count;
      return ` ${percentFormatter.format(context.raw)} (${numberFormatter.format(count)} ${count === 1 ? 'resposta' : 'respostas'})`;
    },
  };

  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: items.map((item) => gradeLabel(item.label)),
      datasets: [{
        label: 'Percentual',
        data: items.map((item) => share(item.count, total)),
        backgroundColor: items.map((item) => colors.grade(item.label)),
        borderRadius: 4,
        maxBarThickness: 56,
      }],
    },
    options,
  });
}

/** Linha com o total por período (dia do mês, últimos 6 meses) */
function countLine(canvas, colors, items, { showValues = false } = {}) {
  const options = baseOptions(colors, {
    labels: showValues ? { formatter: (value) => numberFormatter.format(value) } : undefined,
  });
  options.plugins.tooltip.callbacks = {
    label: (context) => ` ${numberFormatter.format(context.raw)} ${context.raw === 1 ? 'resposta' : 'respostas'}`,
  };

  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: items.map((item) => item.label),
      datasets: [{
        label: 'Respostas',
        data: items.map((item) => item.count),
        borderColor: colors.line,
        backgroundColor: colors.lineFill,
        pointBackgroundColor: colors.line,
        pointBorderColor: colors.surface,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2,
        tension: 0.3,
        fill: true,
      }],
    },
    options,
  });
}

// ── Descrição para leitor de tela ────────────────────────────

function peak(items, countOf) {
  return items.reduce((best, item) => (countOf(item) > countOf(best) ? item : best), items[0]);
}

function seriesTotal(item) {
  return Object.values(item.grades).reduce((sum, count) => sum + count, 0);
}

function describeShares(title, items) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const parts = items.map((item) => `${gradeLabel(item.label)}: ${percentFormatter.format(share(item.count, total))}`);
  return `${title}. ${parts.join('; ')}.`;
}

// ── Componente ───────────────────────────────────────────────

/**
 * Monta os 6 gráficos do dashboard e os refaz quando o tema muda.
 * @param {HTMLElement} root elemento que contém os <canvas> .js-chart-*
 */
export function initSatisfactionCharts(root) {
  const canvases = {
    hour: root.querySelector('.js-chart-hour'),
    weekday: root.querySelector('.js-chart-weekday'),
    gradeAll: root.querySelector('.js-chart-grade-all'),
    gradeValid: root.querySelector('.js-chart-grade-valid'),
    day: root.querySelector('.js-chart-day'),
    months: root.querySelector('.js-chart-months'),
  };
  let charts = [];
  let current = null;

  function build(data) {
    charts.forEach((chart) => chart.destroy());

    const colors = readColors();
    Chart.defaults.font.family = colors.font;
    Chart.defaults.color = colors.text;

    const validGrades = data.byGrade.filter((item) => item.label !== NO_ANSWER);

    charts = [
      stackedByGrade(canvases.hour, colors, data.grades, data.byHour, (hour) => `${hour}h`),
      stackedByGrade(canvases.weekday, colors, data.grades, data.byWeekDay, (day) => day),
      gradeShare(canvases.gradeAll, colors, data.byGrade),
      gradeShare(canvases.gradeValid, colors, validGrades),
      countLine(canvases.day, colors, data.byDay),
      countLine(canvases.months, colors, data.lastSixMonths, { showValues: true }),
    ];

    // O canvas é role="img": o resumo em texto substitui o desenho para o leitor de tela
    if (data.byHour.length) {
      const top = peak(data.byHour, seriesTotal);
      canvases.hour.setAttribute('aria-label', `Respostas por horário. Horário com mais respostas: ${top.label}h, com ${seriesTotal(top)}.`);
    }
    if (data.byWeekDay.length) {
      const top = peak(data.byWeekDay, seriesTotal);
      canvases.weekday.setAttribute('aria-label', `Avaliações por dia da semana. Dia com mais avaliações: ${top.label}, com ${seriesTotal(top)}.`);
    }
    canvases.gradeAll.setAttribute('aria-label', describeShares('Distribuição por nota, geral', data.byGrade));
    canvases.gradeValid.setAttribute('aria-label', describeShares('Distribuição por nota, válidas', validGrades));
    if (data.byDay.length) {
      const top = peak(data.byDay, (item) => item.count);
      canvases.day.setAttribute('aria-label', `Avaliações por dia do mês. Dia com mais avaliações: ${top.label}, com ${top.count}.`);
    }
    canvases.months.setAttribute('aria-label', `Avaliações nos últimos 6 meses. ${data.lastSixMonths.map((item) => `${item.label}: ${item.count}`).join('; ')}.`);
  }

  // Troca de tema (core/theme.js muda o data-theme do <html>): refaz com as cores novas
  new MutationObserver(() => {
    if (current) build(current);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  return {
    /** @param {object} data resposta de GET api/satisfaction-surveys/dashboard */
    render(data) {
      current = data;
      build(data);
    },
  };
}
