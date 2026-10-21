package com.joao_v_marques.portal_atendimento.service_requests.type.dto;

public record ServiceRequestTypeResponse(
        Integer id,
        String name,
        boolean isActive
) {
}
