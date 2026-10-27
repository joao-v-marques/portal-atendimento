package com.joao_v_marques.portal_atendimento.users.user_roles;

import com.joao_v_marques.portal_atendimento.exception.ConflictException;
import com.joao_v_marques.portal_atendimento.exception.ResourceNotFoundException;
import com.joao_v_marques.portal_atendimento.users.user_roles.dto.UserRoleIsActiveResponse;
import com.joao_v_marques.portal_atendimento.users.user_roles.dto.UserRoleRequest;
import com.joao_v_marques.portal_atendimento.users.user_roles.dto.UserRoleResponse;
import com.joao_v_marques.portal_atendimento.users.user_roles.dto.UserRoleUpdateRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class UserRoleService {

    // Desativar o ADMIN tiraria a opção de promover novos administradores pela tela de usuários
    private static final String ADMIN_ROLE = "ADMIN";

    private final UserRolesRepository userRolesRepository;

    public UserRoleService(UserRolesRepository userRolesRepository) {
        this.userRolesRepository = userRolesRepository;
    }

    // GET de todas as roles cadastradas, com quantos usuários ativos cada uma tem
    @Transactional(readOnly = true)
    public List<UserRoleResponse> findAll() {
        Map<Integer, Long> activeUsers = userRolesRepository.countActiveUsersByRole()
                .stream()
                .collect(Collectors.toMap(row -> (Integer) row[0], row -> (Long) row[1]));

        return userRolesRepository.findAll()
                .stream()
                .map(userRole -> toResponse(userRole, activeUsers.getOrDefault(userRole.getId(), 0L)))
                .toList();
    }

    @Transactional
    public UserRoleResponse create(UserRoleRequest request) {
        String name = request.name().trim();
        String label = request.label().trim();

        if (userRolesRepository.existsByNameIgnoreCase(name)) {
            throw new ConflictException("Já existe uma função com esse código.");
        }

        if (userRolesRepository.existsByLabelIgnoreCase(label)) {
            throw new ConflictException("Já existe uma função com esse nome.");
        }

        // Montar entidade com base na dto
        UserRole userRole = new UserRole();
        userRole.setName(name);
        userRole.setLabel(label);

        UserRole saved = userRolesRepository.save(userRole);

        return toResponse(saved, 0L);
    }

    @Transactional
    public UserRoleResponse update(Integer userRoleId, UserRoleUpdateRequest request) {
        String label = request.label().trim();

        // Valida se a role editada realmente existe
        UserRole userRole = findById(userRoleId);

        // Validações que a DTO não cobre
        if (!userRole.isActive()) {
            throw new ConflictException("Não é possível editar uma função inativa.");
        }

        if (userRolesRepository.existsByLabelIgnoreCaseAndIdNot(label, userRoleId)) {
            throw new ConflictException("Já existe uma função com esse nome.");
        }

        // Só o nome de exibição muda: o código é referenciado nas permissões
        userRole.setLabel(label);

        return toResponse(userRole, userRolesRepository.countActiveUsers(userRoleId));
    }

    @Transactional
    public UserRoleIsActiveResponse deactivate(Integer userRoleId) {
        // Valida se a role desativada realmente existe
        UserRole userRole = findById(userRoleId);

        if (!userRole.isActive()) {
            throw new ConflictException("Esta função já está inativa.");
        }

        if (ADMIN_ROLE.equals(userRole.getName())) {
            throw new ConflictException("A função de administrador não pode ser desativada.");
        }

        userRole.setActive(false);

        return toIsActiveResponse(userRole);
    }

    @Transactional
    public UserRoleIsActiveResponse reactivate(Integer userRoleId) {
        // Valida se a role reativada realmente existe
        UserRole userRole = findById(userRoleId);

        if (userRole.isActive()) {
            throw new ConflictException("Esta função já está ativa.");
        }

        userRole.setActive(true);

        return toIsActiveResponse(userRole);
    }

    private UserRole findById(Integer userRoleId) {
        return userRolesRepository.findById(userRoleId)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrada nenhuma função com o ID fornecido."));
    }

    private UserRoleResponse toResponse(UserRole userRole, long activeUsers) {
        return new UserRoleResponse(
                userRole.getId(),
                userRole.getName(),
                userRole.getLabel(),
                userRole.isActive(),
                activeUsers
        );
    }

    private UserRoleIsActiveResponse toIsActiveResponse(UserRole userRole) {
        return new UserRoleIsActiveResponse(
                userRole.getName(),
                userRole.isActive()
        );
    }
}
