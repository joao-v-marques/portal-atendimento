package com.joao_v_marques.portal_atendimento.satisfaction_survey;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.file.Path;

@ConfigurationProperties(prefix = "app.satisfaction-survey")
public record SatisfactionSurveyProperties(
        Path csvPath,

        String delimiter,

        String charset
) {
    public SatisfactionSurveyProperties {
        if (csvPath == null) {
            throw new IllegalStateException(
                    "Configuração ausente: defina 'app.satisfaction-survey.csv-path' no application.yaml");
        }
        csvPath = csvPath.toAbsolutePath().normalize();

        if (delimiter == null || delimiter.isEmpty()) {
            delimiter = ";";
        } else if (delimiter.equalsIgnoreCase("tab") || delimiter.equals("\\t")) {
            delimiter = "\t";
        }
        if (delimiter.length() != 1) {
            throw new IllegalArgumentException("app.satisfaction-survey.delimiter deve ter 1 caractere (ou 'tab')");
        }

        if (charset == null || charset.isBlank()) {
            charset = "UTF-8";
        }
    }
}
