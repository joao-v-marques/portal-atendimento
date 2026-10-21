package com.joao_v_marques.portal_atendimento.service_requests.service_request;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ServiceRequestRepository extends JpaRepository<ServiceRequest, Integer> {

    boolean existsByProtocolNumber(String protocolNumber);

    boolean existsByProtocolNumberAndIdNot(String protocolNumber, Integer id);

    // EntityGraph: todas as relações vão no ServiceRequestResponse, e sem ele seriam até 8 SELECTs por chamado
    @EntityGraph(attributePaths = {"category", "channel", "type", "severity", "status", "assignedTo", "insertedBy", "updatedBy"})
    List<ServiceRequest> findAllByOrderByOpenedAtDesc();

    @EntityGraph(attributePaths = {"category", "channel", "type", "severity", "status", "assignedTo", "insertedBy", "updatedBy"})
    Optional<ServiceRequest> findWithDetailsById(Integer id);
}
