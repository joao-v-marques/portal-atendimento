package com.joao_v_marques.portal_atendimento.users.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Integer> {

    boolean existsByUsernameIgnoreCase(String username);

    @Query("SELECT u FROM User u JOIN FETCH u.role WHERE u.username = :username")
    Optional<User> findByUsername(@Param("username") String username);

    // JOIN FETCH: o perfil vai serializado no UserResponse, e sem ele seria um SELECT por usuário
    @Query("SELECT u FROM User u JOIN FETCH u.role")
    List<User> findAllWithRole();

    // Usuários ativos de um perfil, para listar os responsáveis possíveis de um chamado
    @Query("SELECT u FROM User u JOIN FETCH u.role r WHERE u.isActive = true AND r.name = :roleName ORDER BY u.name")
    List<User> findActiveByRoleName(@Param("roleName") String roleName);
}
