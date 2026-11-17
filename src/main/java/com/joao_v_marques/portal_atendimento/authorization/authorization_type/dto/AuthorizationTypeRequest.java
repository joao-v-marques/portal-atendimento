package com.joao_v_marques.portal_atendimento.authorization.authorization_type.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record AuthorizationTypeRequest(

        // Código TUSS: 8 dígitos (mesma regra do ck_authorization_type_code)
        @NotBlank(message = "Informe o código do procedimento")
        @Pattern(regexp = "^\\d{8}$", message = "O código deve ter exatamente 8 dígitos")
        String code,

        @NotBlank(message = "Informe o nome do procedimento")
        @Size(max = 500, message = "O nome deve ter no máximo 500 caracteres")
        String name,

        // Prazo da ANS em dias úteis; 0 = atendimento imediato
        @NotNull(message = "Informe o prazo da ANS")
        @Min(value = 0, message = "O prazo não pode ser negativo")
        @Max(value = 365, message = "O prazo deve ser de no máximo 365 dias úteis")
        Integer maxDays
) {
}
