package com.joao_v_marques.portal_atendimento.satisfaction_survey.dto;

import java.util.Map;

// Contagem por nota de um grupo (horário, dia da semana). Mapa na ordem 1..5, Sem resposta
public record GradeSeries(
        String label,
        Map<String, Long> grades
) {
}
