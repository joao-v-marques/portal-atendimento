package com.joao_v_marques.portal_atendimento.authorization.authorization_status;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthorizationStatusRepository extends JpaRepository<AuthorizationStatus, Integer> {

    boolean existsByNameIgnoreCase(String name);
}
