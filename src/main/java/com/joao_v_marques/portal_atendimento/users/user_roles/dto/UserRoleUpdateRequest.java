package com.joao_v_marques.portal_atendimento.users.user_roles.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// Sem o código: ele é referenciado no SecurityConfig e no front, então não muda depois de criado
public record UserRoleUpdateRequest(
        @NotBlank(message = "Preencha o nome da função")
        @Size(max = 100, message = "O nome deve ter no máximo 100 caracteres")
        String label
) {
}
