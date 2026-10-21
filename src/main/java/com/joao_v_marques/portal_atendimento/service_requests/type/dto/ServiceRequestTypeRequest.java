package com.joao_v_marques.portal_atendimento.service_requests.type.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ServiceRequestTypeRequest(

        @NotBlank(message = "Informe o nome do tipo de atendimento")
        @Size(max = 100, message = "O nome do tipo de atendimento deve ter no máximo 100 caracteres")
        String name
) {
}
