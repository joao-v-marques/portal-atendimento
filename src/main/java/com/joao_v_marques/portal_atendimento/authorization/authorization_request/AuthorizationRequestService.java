package com.joao_v_marques.portal_atendimento.authorization.authorization_request;

import com.joao_v_marques.portal_atendimento.authorization.authorization_request.dto.AuthorizationRequestResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AuthorizationRequestService {

    private final AuthorizationRequestRepository authorizationRequestRepository;

    public AuthorizationRequestService(AuthorizationRequestRepository authorizationRequestRepository) {
        this.authorizationRequestRepository = authorizationRequestRepository;
    }

    // GET de todas as autorizações cadastradas
    @Transactional(readOnly = true)
    public List<AuthorizationRequestResponse> findAll() {
        return authorizationRequestRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private AuthorizationRequestResponse toResponse(AuthorizationRequest authorizationRequest) {
        return new AuthorizationRequestResponse(
                authorizationRequest.getId(),
                authorizationRequest.getTransactionNumber(),
                authorizationRequest.getRequestDate(),
                authorizationRequest.getAuthorizationType(),
                authorizationRequest.getAuthorizationStatus(),
                authorizationRequest.getBeneficiaryName(),
                authorizationRequest.getBeneficiaryPhone(),
                authorizationRequest.getCreatedAt(),
                authorizationRequest.getInsertedBy()
        );
    }
}
