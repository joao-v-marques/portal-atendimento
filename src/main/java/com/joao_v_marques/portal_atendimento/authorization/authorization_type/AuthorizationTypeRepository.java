package com.joao_v_marques.portal_atendimento.authorization.authorization_type;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthorizationTypeRepository extends JpaRepository<AuthorizationType, Integer> {

    boolean existsByNameIgnoreCase(String name);
}
