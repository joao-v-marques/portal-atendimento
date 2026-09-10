package com.joao_v_marques.portal_atendimento.authorization.authorization_type.dto;

import jakarta.validation.constraints.NotBlank;

public record AuthorizationTypeRequest(

        @NotBlank(message = "Informe o nome do tipo de autorização")
        String name
) {
}
