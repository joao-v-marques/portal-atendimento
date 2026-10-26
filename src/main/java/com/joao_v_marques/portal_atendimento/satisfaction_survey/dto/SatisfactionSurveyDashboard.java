package com.joao_v_marques.portal_atendimento.satisfaction_survey.dto;

import java.time.YearMonth;
import java.util.List;

public record SatisfactionSurveyDashboard(
        YearMonth month,
        List<YearMonth> availableMonths,
        long total,
        long valid,
        List<String> grades,
        List<GradeSeries> byHour,
        List<GradeSeries> byWeekDay,
        List<CountItem> byGrade,
        List<CountItem> byDay,
        List<CountItem> lastSixMonths
) {
}
