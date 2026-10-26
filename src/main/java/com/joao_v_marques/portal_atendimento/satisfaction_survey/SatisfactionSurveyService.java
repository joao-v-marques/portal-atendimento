package com.joao_v_marques.portal_atendimento.satisfaction_survey;

import com.joao_v_marques.portal_atendimento.exception.SatisfactionSurveyException;
import com.joao_v_marques.portal_atendimento.satisfaction_survey.dto.CountItem;
import com.joao_v_marques.portal_atendimento.satisfaction_survey.dto.GradeSeries;
import com.joao_v_marques.portal_atendimento.satisfaction_survey.dto.PageResponse;
import com.joao_v_marques.portal_atendimento.satisfaction_survey.dto.SatisfactionSurveyDashboard;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

@Service
public class SatisfactionSurveyService {

    private static final int MAX_SIZE = 500;

    private static final String NO_ANSWER = "Sem resposta";
    private static final List<String> GRADES = List.of("1", "2", "3", "4", "5", NO_ANSWER);
    private static final List<String> WEEK_DAYS = List.of("SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM");
    private static final DateTimeFormatter DAY_LABEL = DateTimeFormatter.ofPattern("dd/MM");
    private static final DateTimeFormatter MONTH_LABEL = DateTimeFormatter.ofPattern("MM/yyyy");

    // Exportação pensada para abrir direto no Excel brasileiro: ";" como separador e UTF-8 com BOM
    private static final CSVFormat EXPORT_FORMAT = CSVFormat.DEFAULT.builder()
            .setDelimiter(';')
            .setRecordSeparator("\r\n")
            .build();

    private final SatisfactionSurveyRepository repository;

    public SatisfactionSurveyService(SatisfactionSurveyRepository repository) {
        this.repository = repository;
    }

    // Lista paginada, com filtro opcional por período (inclusive nas duas pontas)
    public PageResponse<SatisfactionSurvey> list(LocalDate start, LocalDate end, int page, int size) {
        if (page < 0) {
            throw new IllegalArgumentException("A página não pode ser negativa.");
        }
        if (size < 1 || size > MAX_SIZE) {
            throw new IllegalArgumentException("O tamanho da página deve estar entre 1 e " + MAX_SIZE + ".");
        }

        List<SatisfactionSurvey> filtered = filter(start, end);
        long total = filtered.size();
        int totalPages = (int) ((total + size - 1) / size);

        int de = (int) Math.min((long) page * size, total);
        int ate = (int) Math.min((long) de + size, total);

        return new PageResponse<>(filtered.subList(de, ate), page, size, total, totalPages);
    }

    // Gera o conteúdo de um novo CSV com os registros do período
    public byte[] export(LocalDate inicio, LocalDate fim) {
        List<SatisfactionSurvey> filtered = filter(inicio, fim);

        StringWriter exit = new StringWriter();
        exit.write('\uFEFF');
        try (CSVPrinter printer = new CSVPrinter(exit, EXPORT_FORMAT)) {
            printer.printRecord(SatisfactionSurvey.COLUMNS);
            for (SatisfactionSurvey r : filtered) {
                printer.printRecord(r.values());
            }
        } catch (IOException e) {
            throw new SatisfactionSurveyException("Não foi possível gerar o arquivo de exportação.", e);
        }
        return exit.toString().getBytes(StandardCharsets.UTF_8);
    }

    // Indicadores do mês, já agrupados para os gráficos. Sem mês: usa o do registro mais recente
    public SatisfactionSurveyDashboard dashboard(YearMonth month) {
        List<SatisfactionSurvey> all = repository.listar();
        // Meses com respostas, do mais recente para o mais antigo (opções do filtro na tela)
        List<YearMonth> availableMonths = all.stream()
                .map(r -> YearMonth.from(r.date()))
                .distinct()
                .sorted(Comparator.reverseOrder())
                .toList();
        YearMonth target = month != null ? month
                : availableMonths.isEmpty() ? YearMonth.now() : availableMonths.get(0);

        List<SatisfactionSurvey> inMonth = all.stream()
                .filter(r -> YearMonth.from(r.date()).equals(target))
                .toList();

        long valid = inMonth.stream().filter(r -> !NO_ANSWER.equals(normalizeGrade(r.grade()))).count();

        // TreeMap deixa horários, dias da semana e datas em ordem
        Map<Integer, List<SatisfactionSurvey>> byHour = new TreeMap<>(inMonth.stream()
                .collect(Collectors.groupingBy(r -> r.answerHour() != null ? r.answerHour() : r.hour().getHour())));
        Map<DayOfWeek, List<SatisfactionSurvey>> byWeekDay = new TreeMap<>(inMonth.stream()
                .collect(Collectors.groupingBy(r -> r.date().getDayOfWeek())));
        Map<LocalDate, Long> byDay = new TreeMap<>(inMonth.stream()
                .collect(Collectors.groupingBy(SatisfactionSurvey::date, Collectors.counting())));

        Map<String, Long> gradeCounts = countGrades(inMonth);
        List<CountItem> byGrade = gradeCounts.entrySet().stream()
                .map(e -> new CountItem(e.getKey(), e.getValue()))
                .toList();

        Map<YearMonth, Long> perMonth = all.stream()
                .collect(Collectors.groupingBy(r -> YearMonth.from(r.date()), Collectors.counting()));
        List<CountItem> lastSixMonths = new ArrayList<>();
        for (int i = 5; i >= 0; i--) {
            YearMonth m = target.minusMonths(i);
            lastSixMonths.add(new CountItem(m.format(MONTH_LABEL), perMonth.getOrDefault(m, 0L)));
        }

        return new SatisfactionSurveyDashboard(
                target,
                availableMonths,
                inMonth.size(),
                valid,
                GRADES,
                byHour.entrySet().stream()
                        .map(e -> new GradeSeries(String.valueOf(e.getKey()), countGrades(e.getValue())))
                        .toList(),
                byWeekDay.entrySet().stream()
                        .map(e -> new GradeSeries(WEEK_DAYS.get(e.getKey().getValue() - 1), countGrades(e.getValue())))
                        .toList(),
                byGrade,
                byDay.entrySet().stream()
                        .map(e -> new CountItem(e.getKey().format(DAY_LABEL), e.getValue()))
                        .toList(),
                lastSixMonths);
    }

    private static Map<String, Long> countGrades(List<SatisfactionSurvey> records) {
        Map<String, Long> counts = new LinkedHashMap<>();
        GRADES.forEach(g -> counts.put(g, 0L));
        records.forEach(r -> counts.merge(normalizeGrade(r.grade()), 1L, Long::sum));
        return counts;
    }

    // Nota de 1 a 5; qualquer outro valor (inclusive "Sem resposta" e vazio) conta como sem resposta
    private static String normalizeGrade(String grade) {
        String value = grade == null ? "" : grade.trim();
        return GRADES.subList(0, 5).contains(value) ? value : NO_ANSWER;
    }

    private List<SatisfactionSurvey> filter(LocalDate start, LocalDate end) {
        if (start != null && end != null && start.isAfter(end)) {
            throw new IllegalArgumentException("A data inicial não pode ser depois da data final.");
        }
        return repository.listar().stream()
                .filter(r -> start == null || !r.date().isBefore(start))
                .filter(r -> end == null || !r.date().isAfter(end))
                .toList();
    }
}
