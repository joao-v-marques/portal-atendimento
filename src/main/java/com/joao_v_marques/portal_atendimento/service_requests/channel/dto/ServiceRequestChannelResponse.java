package com.joao_v_marques.portal_atendimento.service_requests.channel.dto;

public record ServiceRequestChannelResponse(
        Integer id,
        String name,
        boolean isActive
) {
}
