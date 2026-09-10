package com.joao_v_marques.portal_atendimento.authorization_requests.authorization_status.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AuthorizationStatusRequest(

        @NotBlank(message = "Informe o nome do status da autorização")
        @Size(max = 255, message = "O nome do status da autorização deve ter no máximo 255 caracteres")
        String name
) {
}
