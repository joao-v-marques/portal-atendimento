package com.joao_v_marques.portal_atendimento.users.user_roles.dto;

public record UserRoleResponse(
        Integer id,
        String name,
        String label,
        boolean isActive,
        long activeUsers
) {
}
