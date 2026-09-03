package com.joao_v_marques.portal_atendimento.users.user_roles;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserRoleService {

    private final UserRolesRepository userRolesRepository;

    public UserRoleService(UserRolesRepository userRolesRepository) {
        this.userRolesRepository = userRolesRepository;
    }

    // GET de todas as roles cadastradas
    @Transactional(readOnly = true)
    public List<UserRoleResponse> findAll() {
        return userRolesRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private UserRoleResponse toResponse(UserRole userRole) {
        return new UserRoleResponse(
                userRole.getId(),
                userRole.getName(),
                userRole.isActive()
        );
    }
}
