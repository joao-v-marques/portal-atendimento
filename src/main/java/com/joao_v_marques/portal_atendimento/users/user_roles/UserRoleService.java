package com.joao_v_marques.portal_atendimento.users.user_roles;

import com.joao_v_marques.portal_atendimento.users.user_roles.dto.UserRoleIsActiveResponse;
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

    @Transactional
    public UserRoleResponse update(Integer userRoleId, UserRoleRequest request) {
        String name = request.name().trim();

        // Valida se a role editada realmente existe
        UserRole userRole = userRolesRepository.findById(userRoleId)
                .orElseThrow(() -> new IllegalArgumentException("Não foi encontrado nenhuma função de usuário com o ID fornecido."));

        // Validações que a DTO não cobre
        if (!userRole.isActive()) {
            throw new IllegalArgumentException("Não é possível editar uma ocorrência inativa.");
        }

        // Atualizar a entidade já existente
        userRole.setName(name);

        return toResponse(userRole);
    }

    @Transactional
    public UserRoleIsActiveResponse deactivate(Integer userRoleId) {
        // Valida se a role desativada realmente existe
        UserRole userRole = userRolesRepository.findById(userRoleId)
                .orElseThrow(() -> new IllegalArgumentException("Não foi encontrado nenhuma função de usuário com o ID fornecido."));

        if (!userRole.isActive()) {
            throw new IllegalArgumentException("Esta função já está inativa.");
        }

        userRole.setActive(false);

        return toIsActiveResponse(userRole);
    }

    @Transactional
    public UserRoleIsActiveResponse reactivate(Integer userRoleId) {
        // Valida se a role desativada realmente existe
        UserRole userRole = userRolesRepository.findById(userRoleId)
                .orElseThrow(() -> new IllegalArgumentException("Não foi encontrado nenhuma função de usuário com o ID fornecido."));

        if (userRole.isActive()) {
            throw new IllegalArgumentException("Esta função já está ativa.");
        }

        userRole.setActive(true);

        return toIsActiveResponse(userRole);
    }

    private UserRoleResponse toResponse(UserRole userRole) {
        return new UserRoleResponse(
                userRole.getId(),
                userRole.getName(),
                userRole.isActive()
        );
    }

    private UserRoleIsActiveResponse toIsActiveResponse(UserRole userRole) {
        return new UserRoleIsActiveResponse(
                userRole.getName(),
                userRole.isActive()
        );
    }
}
