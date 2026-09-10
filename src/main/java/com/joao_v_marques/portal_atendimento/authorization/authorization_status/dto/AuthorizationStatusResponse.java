package com.joao_v_marques.portal_atendimento.authorization.authorization_status.dto;

public record AuthorizationStatusResponse(
        Integer id,
        String name,
        boolean isActive
) {
}
