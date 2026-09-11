package com.joao_v_marques.portal_atendimento.authorization.authorization_request_document;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AuthorizationRequestDocumentRepository extends JpaRepository<AuthorizationRequestDocument, Integer> {

    List<AuthorizationRequestDocument> findByAuthorizationRequestId(Integer requestId);
    long countByAuthorizationRequestId(Integer requestId);
    boolean existsByStoredPath(String storedPath);
    Optional<AuthorizationRequestDocument> findByIdAndAuthorizationRequestId(Integer id, Integer requestId);
}
