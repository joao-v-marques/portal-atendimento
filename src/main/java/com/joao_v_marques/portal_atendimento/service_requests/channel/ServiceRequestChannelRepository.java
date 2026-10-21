package com.joao_v_marques.portal_atendimento.service_requests.channel;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ServiceRequestChannelRepository extends JpaRepository<ServiceRequestChannel, Integer> {

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Integer id);
}
