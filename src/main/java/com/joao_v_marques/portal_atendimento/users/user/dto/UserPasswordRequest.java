package com.joao_v_marques.portal_atendimento.users.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UserPasswordRequest(

        @NotBlank(message = "Informe a senha")
        @Size(min = 4, max = 72, message = "A senha deve ter entre 4 e 72 caracteres")
        String password
) {
}
