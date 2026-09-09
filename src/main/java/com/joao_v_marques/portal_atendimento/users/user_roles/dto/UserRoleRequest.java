package com.joao_v_marques.portal_atendimento.users.user_roles.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UserRoleRequest(
        @NotBlank(message = "Preencha o nome da role")
        @Size(max = 255, message = "O campo deve ter no máximo 255 caracteres")
        String name
) {
}
