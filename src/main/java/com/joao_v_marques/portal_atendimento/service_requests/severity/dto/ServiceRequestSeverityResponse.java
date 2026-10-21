package com.joao_v_marques.portal_atendimento.service_requests.severity.dto;

public record ServiceRequestSeverityResponse(
        Integer id,
        String name,
        Short level,
        boolean isActive
) {
}
