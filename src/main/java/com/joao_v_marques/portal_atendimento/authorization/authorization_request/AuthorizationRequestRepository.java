package com.joao_v_marques.portal_atendimento.authorization.authorization_request;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface AuthorizationRequestRepository extends JpaRepository<AuthorizationRequest, Integer> {

    boolean existsByTransactionNumber(String transactionNumber);

    // SELECT ... FOR UPDATE: serializa os uploads da mesma autorização até o fim da transação.
    // Protege o limite de documentos (count) e a escolha do nome do arquivo (existsByStoredPath).
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT ar FROM AuthorizationRequest ar WHERE ar.id = :id")
    Optional<AuthorizationRequest> findByIdForUpdate(@Param("id") Integer id);
}
