package com.joao_v_marques.portal_atendimento.satisfaction_survey;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

public record SatisfactionSurvey(
        LocalDate date,
        LocalTime hour,
        Integer ask1,
        String finisher,
        Integer time,
        Integer status,
        Integer month,
        String weekDay,
        Integer answerTime,
        String grade
) {

    static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    static final DateTimeFormatter HOUR_FORMAT = DateTimeFormatter.ofPattern("HH:mm:ss");

    // Cabeçalho do CSV, está em pt-BR e na ordem das colunas
    public static final List<String> COLUMNS = List.of(
            "Data", "Hora", "Perg. 1", "Finalizador", "Tempo", "Status",
            "Mês", "Dia da semana", "Hora resposta", "Nota"
    );

    // Valores na ordem das colunas, no formato do arquivo
    public Object[] values() {
        return new Object[] {
                date.format(DATE_FORMAT), hour.format(HOUR_FORMAT),
                ask1, finisher, time, status,
                month, weekDay, answerTime, grade
        };
    }
}
