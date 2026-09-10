package com.joao_v_marques.portal_atendimento.authorization_requests.authorization_type;

import com.joao_v_marques.portal_atendimento.authorization_requests.authorization_type.dto.AuthorizationTypeRequest;
import com.joao_v_marques.portal_atendimento.authorization_requests.authorization_type.dto.AuthorizationTypeResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AuthorizationTypeService {

    private final AuthorizationTypeRepository authorizationTypeRepository;

    public AuthorizationTypeService(AuthorizationTypeRepository authorizationTypeRepository) {
        this.authorizationTypeRepository = authorizationTypeRepository;
    }

    @Transactional(readOnly = true)
    public List<AuthorizationTypeResponse> findAll() {
        return authorizationTypeRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public AuthorizationTypeResponse create(AuthorizationTypeRequest request) {
        String name = request.name().trim();

        if (authorizationTypeRepository.existsByNameIgnoreCase(name)) {
            throw new IllegalArgumentException("Já existe um tipo de autorização com o nome informado.");
        }

        // Montar entidade com base na DTO
        AuthorizationType authorizationType = new AuthorizationType();
        authorizationType.setName(name);

        AuthorizationType saved = authorizationTypeRepository.save(authorizationType);

        return toResponse(saved);
    }

    private AuthorizationTypeResponse toResponse(AuthorizationType authorizationType) {
        return new AuthorizationTypeResponse(
                authorizationType.getId(),
                authorizationType.getName(),
                authorizationType.isActive()
        );
    }
}
