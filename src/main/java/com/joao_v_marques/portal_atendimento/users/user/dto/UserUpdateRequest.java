package com.joao_v_marques.portal_atendimento.users.user.dto;

import jakarta.validation.constraints.*;

public record UserUpdateRequest(

        @Size(max = 255, message = "O campo de usuário deve ter no máximo 255 caracteres")
        String username,

        @Size(max = 255, message = "O campo de nome deve ter no máximo 255 caracteres")
        String name,

        @Size(max = 255, message = "O campo de email deve ter no máximo 255 caracteres")
        @Email(message = "Informe um email válido")
        String email,

        @Positive(message = "Perfil de acesso inválido")
        Integer roleId
) {
}
