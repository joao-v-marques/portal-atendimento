package com.joao_v_marques.portal_atendimento.service_requests.category.dto;

public record ServiceRequestCategoryResponse(
        Integer id,
        String name,
        boolean isActive
) {
}
