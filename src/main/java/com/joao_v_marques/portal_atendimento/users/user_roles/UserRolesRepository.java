package com.joao_v_marques.portal_atendimento.users.user_roles;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface UserRolesRepository extends JpaRepository<UserRole, Integer> {

    boolean existsByNameIgnoreCase(String name);

    boolean existsByLabelIgnoreCase(String label);

    boolean existsByLabelIgnoreCaseAndIdNot(String label, Integer id);

    // Usuários ativos por role numa consulta só, para a listagem não fazer um COUNT por linha.
    // Cada item é [roleId, quantidade]; roles sem usuário ativo não aparecem
    @Query("SELECT u.role.id, COUNT(u) FROM User u WHERE u.isActive = true GROUP BY u.role.id")
    List<Object[]> countActiveUsersByRole();

    @Query("SELECT COUNT(u) FROM User u WHERE u.isActive = true AND u.role.id = :roleId")
    long countActiveUsers(@Param("roleId") Integer roleId);
}
