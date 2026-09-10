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

    @Transactional
    public AuthorizationTypeResponse update(Integer id, AuthorizationTypeRequest request) {
        String name = request.name().trim();

        // Validar se a AuthorizationType realmente existe
        AuthorizationType authorizationType = authorizationTypeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Não foi encontrado tipo de autorização com o ID informado."));

        if (!authorizationType.isActive()) {
            throw new IllegalArgumentException("Não é possível editar um tipo de autorização inativo.");
        }

        authorizationType.setName(name);

        return toResponse(authorizationType);
    }

    @Transactional
    public AuthorizationTypeResponse deactivate(Integer id) {
        AuthorizationType authorizationType = authorizationTypeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Não foi encontrado nenhum tipo de autorização com o ID informado."));

        if (!authorizationType.isActive()) {
            throw new IllegalArgumentException("Não é possível editar um tipo de autorização inativo.");
        }

        authorizationType.setActive(false);

        return toResponse(authorizationType);
    }

    @Transactional
    public AuthorizationTypeResponse reactivate(Integer id) {
        AuthorizationType authorizationType = authorizationTypeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Não foi encontrado nenhum tipo de autorização com o ID informado."));

        if (authorizationType.isActive()) {
            throw new IllegalArgumentException("O tipo de autorização já está inativo");
        }

        authorizationType.setActive(true);

        return toResponse(authorizationType);
    }

    private AuthorizationTypeResponse toResponse(AuthorizationType authorizationType) {
        return new AuthorizationTypeResponse(
                authorizationType.getId(),
                authorizationType.getName(),
                authorizationType.isActive()
        );
    }
}
