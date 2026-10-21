package com.joao_v_marques.portal_atendimento.service_requests.severity;

import com.joao_v_marques.portal_atendimento.exception.ConflictException;
import com.joao_v_marques.portal_atendimento.exception.ResourceNotFoundException;
import com.joao_v_marques.portal_atendimento.service_requests.severity.dto.ServiceRequestSeverityRequest;
import com.joao_v_marques.portal_atendimento.service_requests.severity.dto.ServiceRequestSeverityResponse;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ServiceRequestSeverityService {

    private final ServiceRequestSeverityRepository serviceRequestSeverityRepository;

    public ServiceRequestSeverityService(ServiceRequestSeverityRepository serviceRequestSeverityRepository) {
        this.serviceRequestSeverityRepository = serviceRequestSeverityRepository;
    }

    // Ordenado pelo nível para a lista seguir a escala de severidade
    @Transactional(readOnly = true)
    public List<ServiceRequestSeverityResponse> findAll() {
        return serviceRequestSeverityRepository.findAll(Sort.by("level"))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ServiceRequestSeverityResponse create(ServiceRequestSeverityRequest request) {
        String name = request.name().trim();

        if (serviceRequestSeverityRepository.existsByNameIgnoreCase(name)) {
            throw new ConflictException("Já existe uma severidade com o nome informado.");
        }

        if (serviceRequestSeverityRepository.existsByLevel(request.level())) {
            throw new ConflictException("Já existe uma severidade com o nível informado.");
        }

        // Montar entidade com base na DTO
        ServiceRequestSeverity serviceRequestSeverity = new ServiceRequestSeverity();
        serviceRequestSeverity.setName(name);
        serviceRequestSeverity.setLevel(request.level());

        ServiceRequestSeverity saved = serviceRequestSeverityRepository.save(serviceRequestSeverity);

        return toResponse(saved);
    }

    @Transactional
    public ServiceRequestSeverityResponse update(Integer id, ServiceRequestSeverityRequest request) {
        String name = request.name().trim();

        ServiceRequestSeverity serviceRequestSeverity = findByIdOrThrow(id);

        if (!serviceRequestSeverity.isActive()) {
            throw new IllegalArgumentException("Não é possível editar uma severidade inativa.");
        }

        // Ignora o próprio registro para permitir salvar sem alterar nome ou nível
        if (serviceRequestSeverityRepository.existsByNameIgnoreCaseAndIdNot(name, id)) {
            throw new ConflictException("Já existe uma severidade com o nome informado.");
        }

        if (serviceRequestSeverityRepository.existsByLevelAndIdNot(request.level(), id)) {
            throw new ConflictException("Já existe uma severidade com o nível informado.");
        }

        serviceRequestSeverity.setName(name);
        serviceRequestSeverity.setLevel(request.level());

        return toResponse(serviceRequestSeverity);
    }

    @Transactional
    public ServiceRequestSeverityResponse deactivate(Integer id) {
        ServiceRequestSeverity serviceRequestSeverity = findByIdOrThrow(id);

        if (!serviceRequestSeverity.isActive()) {
            throw new IllegalArgumentException("A severidade já está inativa.");
        }

        serviceRequestSeverity.setActive(false);

        return toResponse(serviceRequestSeverity);
    }

    @Transactional
    public ServiceRequestSeverityResponse reactivate(Integer id) {
        ServiceRequestSeverity serviceRequestSeverity = findByIdOrThrow(id);

        if (serviceRequestSeverity.isActive()) {
            throw new IllegalArgumentException("A severidade já está ativa.");
        }

        serviceRequestSeverity.setActive(true);

        return toResponse(serviceRequestSeverity);
    }

    private ServiceRequestSeverity findByIdOrThrow(Integer id) {
        return serviceRequestSeverityRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrada nenhuma severidade com o ID informado."));
    }

    private ServiceRequestSeverityResponse toResponse(ServiceRequestSeverity serviceRequestSeverity) {
        return new ServiceRequestSeverityResponse(
                serviceRequestSeverity.getId(),
                serviceRequestSeverity.getName(),
                serviceRequestSeverity.getLevel(),
                serviceRequestSeverity.isActive()
        );
    }
}
