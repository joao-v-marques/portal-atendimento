package com.joao_v_marques.portal_atendimento.service_requests.service_request.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ServiceRequestFinishRequest(

        @NotBlank(message = "Preencha a resolução do atendimento")
        String resolution,

        @NotNull(message = "Informe se o problema foi resolvido")
        Boolean resolved
) {
}
