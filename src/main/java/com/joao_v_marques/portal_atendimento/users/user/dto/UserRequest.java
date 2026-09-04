package com.joao_v_marques.portal_atendimento.users.user.dto;

import jakarta.validation.constraints.*;

public record UserRequest(

        @NotBlank(message = "Preencha o campo de usuário")
        @Size(max = 255, message = "O campo de usuário deve ter no máximo 255 caracteres")
        String username,

        @Size(max = 255, message = "O campo de nome deve ter no máximo 255 caracteres")
        String name,

        @NotBlank
        @Size(min = 4, max = 72, message = "A senha deve ter no máximo 72 caracteres")
        String password,

        @Size(max = 255, message = "O campo de email deve ter no máximo 255 caracteres")
        @Email(message = "Informe um email válido")
        String email,

        @NotNull(message = "Informe o perfil de acesso do usuário")
        @Positive(message = "Perfil de acesso inválido")
        Integer roleId
) {
}
