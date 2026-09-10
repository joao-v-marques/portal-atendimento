package com.joao_v_marques.portal_atendimento.authorization_requests.authorization_status;

import com.joao_v_marques.portal_atendimento.authorization_requests.authorization_status.dto.AuthorizationStatusRequest;
import com.joao_v_marques.portal_atendimento.authorization_requests.authorization_status.dto.AuthorizationStatusResponse;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AuthorizationStatusService {

    private final AuthorizationStatusRepository authorizationStatusRepository;

    public AuthorizationStatusService(AuthorizationStatusRepository authorizationStatusRepository) {
        this.authorizationStatusRepository = authorizationStatusRepository;
    }

    // GET de todos AuthorizationStatus cadastrados no sistema
    public List<AuthorizationStatusResponse> findAll() {
        return authorizationStatusRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private AuthorizationStatusResponse toResponse(AuthorizationStatus authorizationStatus) {
        return new AuthorizationStatusResponse(
                authorizationStatus.getId(),
                authorizationStatus.getName(),
                authorizationStatus.isActive()
        );
    }
}
