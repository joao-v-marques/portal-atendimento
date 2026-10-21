package com.joao_v_marques.portal_atendimento.service_requests.severity;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ServiceRequestSeverityRepository extends JpaRepository<ServiceRequestSeverity, Integer> {

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Integer id);

    boolean existsByLevel(Short level);

    boolean existsByLevelAndIdNot(Short level, Integer id);
}
