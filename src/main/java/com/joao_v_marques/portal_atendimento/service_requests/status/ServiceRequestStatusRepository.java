package com.joao_v_marques.portal_atendimento.service_requests.status;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ServiceRequestStatusRepository extends JpaRepository<ServiceRequestStatus, Integer> {

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Integer id);
}
