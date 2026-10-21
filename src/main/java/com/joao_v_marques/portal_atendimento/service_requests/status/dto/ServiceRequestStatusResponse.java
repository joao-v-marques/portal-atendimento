package com.joao_v_marques.portal_atendimento.service_requests.status.dto;

public record ServiceRequestStatusResponse(
        Integer id,
        String name,
        boolean isActive
) {
}
