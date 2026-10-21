package com.joao_v_marques.portal_atendimento.service_requests.status.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ServiceRequestStatusRequest(

        @NotBlank(message = "Informe o nome do status de atendimento")
        @Size(max = 100, message = "O nome do status de atendimento deve ter no máximo 100 caracteres")
        String name
) {
}
