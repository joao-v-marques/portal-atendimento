package com.joao_v_marques.portal_atendimento.service_requests.category;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ServiceRequestCategoryRepository extends JpaRepository<ServiceRequestCategory, Integer> {

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Integer id);
}
