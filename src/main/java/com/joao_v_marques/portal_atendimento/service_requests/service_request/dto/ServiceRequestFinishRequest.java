package com.joao_v_marques.portal_atendimento.service_requests.service_request.dto;

import jakarta.validation.constraints.NotBlank;

public record ServiceRequestFinishRequest(

        @NotBlank(message = "Preencha a resolução do atendimento")
        String resolution
) {
}
