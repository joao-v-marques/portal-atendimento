package com.joao_v_marques.portal_atendimento.satisfaction_survey;

import java.util.List;

public record PageResponse<T>(
        List<T> itens,
        int page,
        int size,
        long total,
        int totalPages
) {
}
