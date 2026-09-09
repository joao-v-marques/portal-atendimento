package com.joao_v_marques.portal_atendimento.users.user_roles;

import com.joao_v_marques.portal_atendimento.users.user.dto.UserResponse;
import com.joao_v_marques.portal_atendimento.users.user_roles.dto.UserRoleRequest;
import com.joao_v_marques.portal_atendimento.users.user_roles.dto.UserRoleResponse;
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

    @Transactional
    public UserRoleResponse create(UserRoleRequest request) {
        String name = request.name().trim();

        if (userRolesRepository.existsByNameIgnoreCase(name)) {
            throw new IllegalArgumentException("A role que está tentando cadastrar já existe");
        }

        // Montar entidade com base na dto
        UserRole userRole = new UserRole();
        userRole.setName(name);

        UserRole saved = userRolesRepository.save(userRole);

        return toResponse(saved);
    }

    private UserRoleResponse toResponse(UserRole userRole) {
        return new UserRoleResponse(
                userRole.getId(),
                userRole.getName(),
                userRole.isActive()
        );
    }
}
