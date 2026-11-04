package com.joao_v_marques.portal_atendimento.service_requests.service_request.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

// IDs já filtrados e ordenados pelo front: a planilha sai na mesma ordem da listagem
public record ServiceRequestExportRequest(
        @NotEmpty(message = "Informe ao menos um atendimento para extrair o relatório.")
        List<Integer> ids
) {
}
