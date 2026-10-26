package com.joao_v_marques.portal_atendimento.satisfaction_survey;

import com.joao_v_marques.portal_atendimento.exception.SatisfactionSurveyException;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Repository;

import java.io.IOException;
import java.io.Reader;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.locks.ReentrantLock;

@Repository
public class SatisfactionSurveyRepository {

    private static final Logger log = LoggerFactory.getLogger(SatisfactionSurveyRepository.class);

    private final Path file;
    private final Charset charset;
    private final CSVFormat format;
    private final ReentrantLock lock = new ReentrantLock();

    // Cache: só relê o arquivo quando a data de modificação ou o tamanho mudam
    private List<SatisfactionSurvey> cache = List.of();
    private long cacheModifyMs = -1;
    private long cacheSize = -1;

    public SatisfactionSurveyRepository(SatisfactionSurveyProperties properties) {
        this.file = properties.csvPath();
        this.charset = Charset.forName(properties.charset());
        this.format = CSVFormat.DEFAULT.builder()
                .setDelimiter(properties.delimiter().charAt(0))
                .setTrim(true)
                .build();
    }

    // Função para leitura
    public List<SatisfactionSurvey> listar() {
        lock.lock();
        try {
            if (Files.notExists(file)) {
                cache = List.of();
                cacheModifyMs = -1;
                cacheSize = -1;
                throw new SatisfactionSurveyException("Arquivo CSV não encontrado. Confira 'app.satisfaction-survey.csv-path' e o acesso à pasta do servidor.");
            }

            BasicFileAttributes attrs = Files.readAttributes(file, BasicFileAttributes.class);
            long modificado = attrs.lastModifiedTime().toMillis();
            long tamanho = attrs.size();

            if (modificado == cacheModifyMs && tamanho == cacheSize) {
                return cache;
            }

            cache = List.copyOf(read());
            cacheModifyMs = modificado;
            cacheSize = tamanho;
            return cache;
        } catch (IOException e) {
            throw new SatisfactionSurveyException("Não foi possível ler o arquivo CSV. Confira o caminho, as permissões e a codificação (app.satisfaction-survey.charset).", e);
        } finally {
            lock.unlock();
        }
    }

    private List<SatisfactionSurvey> read() throws IOException {
        try (Reader r = Files.newBufferedReader(file, charset);
             CSVParser parser = format.parse(r)) {

            List<CSVRecord> records = parser.getRecords();
            List<SatisfactionSurvey> list = new ArrayList<>();

            for (int i = 1; i < records.size(); i++) {
                CSVRecord rec = records.get(i);
                // Linha só com separadores (";;;;;;;;;"): sobra da planilha, não é registro
                if (rec.stream().allMatch(String::isBlank)) {
                    continue;
                }
                boolean ultimo = i == records.size() - 1;
                try {
                    list.add(convert(rec));
                } catch (SatisfactionSurveyException e) {
                    if (!ultimo) {
                        throw e;
                    }
                    log.warn("Última linha do CSV ignorada (provavelmente em gravação): {}", e.getMessage());
                }
            }
            return list;
        }
    }

    private SatisfactionSurvey convert(CSVRecord rec) {
        long numero = rec.getRecordNumber(); // contando o cabeçalho
        if (rec.size() < SatisfactionSurvey.COLUMNS.size()) {
            throw new SatisfactionSurveyException("Registro " + numero + " do CSV tem colunas faltando (esperado "
                    + SatisfactionSurvey.COLUMNS.size() + ", encontrado " + rec.size() + ").");
        }
        try {
            return new SatisfactionSurvey(
                    LocalDate.parse(rec.get(0), SatisfactionSurvey.DATE_FORMAT),
                    LocalTime.parse(rec.get(1), SatisfactionSurvey.HOUR_FORMAT),
                    toInt(rec.get(2)),
                    rec.get(3),
                    toInt(rec.get(4)),
                    toInt(rec.get(5)),
                    toInt(rec.get(6)),
                    rec.get(7),
                    toInt(rec.get(8)),
                    rec.get(9));
        } catch (DateTimeParseException | NumberFormatException e) {
            throw new SatisfactionSurveyException("Registro " + numero + " do CSV com valor inválido: " + e.getMessage(), e);
        }
    }

    private static Integer toInt(String valor) {
        return valor == null || valor.isBlank() ? null : Integer.valueOf(valor.trim());
    }

}
