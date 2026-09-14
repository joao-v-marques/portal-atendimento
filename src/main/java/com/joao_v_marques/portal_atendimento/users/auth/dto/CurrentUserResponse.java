package com.joao_v_marques.portal_atendimento.users.auth.dto;

public record CurrentUserResponse(
        String name,
        String username,
        String role
) {
}
