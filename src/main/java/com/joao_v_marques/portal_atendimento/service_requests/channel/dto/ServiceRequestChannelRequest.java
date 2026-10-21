package com.joao_v_marques.portal_atendimento.service_requests.channel.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ServiceRequestChannelRequest(

        @NotBlank(message = "Informe o nome do canal de atendimento")
        @Size(max = 100, message = "O nome do canal de atendimento deve ter no máximo 100 caracteres")
        String name
) {
}
