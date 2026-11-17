package com.joao_v_marques.portal_atendimento.authorization.authorization_type;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthorizationTypeRepository extends JpaRepository<AuthorizationType, Integer> {

    boolean existsByNameIgnoreCase(String name);

    boolean existsByCode(String code);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Integer id);

    boolean existsByCodeAndIdNot(String code, Integer id);
}
