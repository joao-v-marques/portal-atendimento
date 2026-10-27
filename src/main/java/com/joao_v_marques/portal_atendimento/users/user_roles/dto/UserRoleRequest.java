package com.joao_v_marques.portal_atendimento.users.user_roles.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UserRoleRequest(
        // Código usado nas permissões (ROLE_<name>): maiúsculas, números e _, começando por letra
        @NotBlank(message = "Preencha o código da função")
        @Size(max = 50, message = "O código deve ter no máximo 50 caracteres")
        @Pattern(regexp = "^[A-Z][A-Z0-9_]*$", message = "Use só letras maiúsculas, números e _, começando por letra")
        String name,

        @NotBlank(message = "Preencha o nome da função")
        @Size(max = 100, message = "O nome deve ter no máximo 100 caracteres")
        String label
) {
}
