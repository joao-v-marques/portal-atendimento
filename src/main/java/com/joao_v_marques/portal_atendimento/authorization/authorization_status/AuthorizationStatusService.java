package com.joao_v_marques.portal_atendimento.authorization_requests.authorization_status;

import com.joao_v_marques.portal_atendimento.authorization_requests.authorization_status.dto.AuthorizationStatusRequest;
import com.joao_v_marques.portal_atendimento.authorization_requests.authorization_status.dto.AuthorizationStatusResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AuthorizationStatusService {

    private final AuthorizationStatusRepository authorizationStatusRepository;

    public AuthorizationStatusService(AuthorizationStatusRepository authorizationStatusRepository) {
        this.authorizationStatusRepository = authorizationStatusRepository;
    }

    // GET de todos AuthorizationStatus cadastrados no sistema
    @Transactional(readOnly = true)
    public List<AuthorizationStatusResponse> findAll() {
        return authorizationStatusRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // POST de uma nova AuthorizationStatus na aplicação
    @Transactional
    public AuthorizationStatusResponse create(AuthorizationStatusRequest request) {
        String name = request.name().trim();

        if (authorizationStatusRepository.existsByNameIgnoreCase(name)) {
            throw new IllegalArgumentException("O usuário que está tentando cadastrar já existe");
        }

        // Montar entidade com base na DTO
        AuthorizationStatus authorizationStatus = new AuthorizationStatus();
        authorizationStatus.setName(name);

        AuthorizationStatus saved = authorizationStatusRepository.save(authorizationStatus);

        return toResponse(saved);
    }

    // PUT de uma nova AuthorizationStatus
    @Transactional
    public AuthorizationStatusResponse update(Integer id, AuthorizationStatusRequest request) {
        String name = request.name().trim();

         AuthorizationStatus authorizationStatus = authorizationStatusRepository.findById(id)
                 .orElseThrow(() -> new IllegalArgumentException("Não foi encontrado nenhum status de autorização com o ID informado."));

         if (!authorizationStatus.isActive()) {
             throw new IllegalArgumentException("Não é possível editar um status de autorização inativo.");
         }

         authorizationStatus.setName(name);

         return toResponse(authorizationStatus);
    }

    // Desativar uma AuthorizationStatus
    @Transactional
    public AuthorizationStatusResponse deactivate(Integer id) {
        AuthorizationStatus authorizationStatus = authorizationStatusRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Não foi encontrado nenhum status de autorização com o ID informado."));

        if (!authorizationStatus.isActive()) {
            throw new IllegalArgumentException("Este status da autorização já está inativo.");
        }

        authorizationStatus.setActive(false);

        return toResponse(authorizationStatus);
    }

    // Reativar uma AuthorizationStatus
    @Transactional
    public AuthorizationStatusResponse reactivate(Integer id) {
        AuthorizationStatus authorizationStatus = authorizationStatusRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Não foi encontrado nenhum status de autorização com o ID informado."));

        if (authorizationStatus.isActive()) {
            throw new IllegalArgumentException("Este status da autorização já está ativo");
        }

        authorizationStatus.setActive(true);

        return toResponse(authorizationStatus);
    }

    private AuthorizationStatusResponse toResponse(AuthorizationStatus authorizationStatus) {
        return new AuthorizationStatusResponse(
                authorizationStatus.getId(),
                authorizationStatus.getName(),
                authorizationStatus.isActive()
        );
    }
}
