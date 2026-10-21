package com.joao_v_marques.portal_atendimento.service_requests.severity.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record ServiceRequestSeverityRequest(

        @NotBlank(message = "Informe o nome da severidade")
        @Size(max = 100, message = "O nome da severidade deve ter no máximo 100 caracteres")
        String name,

        @NotNull(message = "Informe o nível da severidade")
        @Positive(message = "O nível da severidade deve ser maior que zero")
        Short level
) {
}
