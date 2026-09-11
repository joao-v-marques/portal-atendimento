package com.joao_v_marques.portal_atendimento.authorization.authorization_request;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthorizationRequestRepository extends JpaRepository<AuthorizationRequest, Integer> {

    boolean existsByTransactionNumber(String transactionNumber);
}
