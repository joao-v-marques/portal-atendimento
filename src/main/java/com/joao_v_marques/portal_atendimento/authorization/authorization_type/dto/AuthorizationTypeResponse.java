package com.joao_v_marques.portal_atendimento.authorization.authorization_type.dto;

public record AuthorizationTypeResponse(
        Integer id,
        String name,
        boolean isActive
) {
}
