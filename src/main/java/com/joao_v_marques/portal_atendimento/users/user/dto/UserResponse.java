package com.joao_v_marques.portal_atendimento.users.user.dto;

import com.joao_v_marques.portal_atendimento.users.user_roles.UserRole;

import java.time.OffsetDateTime;

public record UserResponse(
        Integer id,
        String username,
        String name,
        String passwordHash,
        String email,
        UserRole roleId,
        OffsetDateTime createdAt,
        boolean isActive
) {
}
