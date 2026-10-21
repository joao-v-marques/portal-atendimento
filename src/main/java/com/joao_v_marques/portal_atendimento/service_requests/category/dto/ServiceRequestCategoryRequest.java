package com.joao_v_marques.portal_atendimento.service_requests.category.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ServiceRequestCategoryRequest(

        @NotBlank(message = "Informe o nome da categoria de atendimento")
        @Size(max = 100, message = "O nome da categoria de atendimento deve ter no máximo 100 caracteres")
        String name
) {
}
