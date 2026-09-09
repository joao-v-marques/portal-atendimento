package com.joao_v_marques.portal_atendimento.users.user.dto;

public record UserIsActiveResponse(
        String username,
        String name,
        String email,
        boolean isActive
) {
}
