package com.joao_v_marques.portal_atendimento.satisfaction_survey;

import com.joao_v_marques.portal_atendimento.exception.SatisfactionSurveyException;
import com.joao_v_marques.portal_atendimento.satisfaction_survey.dto.PageResponse;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

@Service
public class SatisfactionSurveyService {

    private static final int MAX_SIZE = 500;

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
