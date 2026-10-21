package com.joao_v_marques.portal_atendimento.service_requests.type;

import com.joao_v_marques.portal_atendimento.exception.ConflictException;
import com.joao_v_marques.portal_atendimento.exception.ResourceNotFoundException;
import com.joao_v_marques.portal_atendimento.service_requests.type.dto.ServiceRequestTypeRequest;
import com.joao_v_marques.portal_atendimento.service_requests.type.dto.ServiceRequestTypeResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ServiceRequestTypeService {

    private final ServiceRequestTypeRepository serviceRequestTypeRepository;

    public ServiceRequestTypeService(ServiceRequestTypeRepository serviceRequestTypeRepository) {
        this.serviceRequestTypeRepository = serviceRequestTypeRepository;
    }

    @Transactional(readOnly = true)
    public List<ServiceRequestTypeResponse> findAll() {
        return serviceRequestTypeRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ServiceRequestTypeResponse create(ServiceRequestTypeRequest request) {
        String name = request.name().trim();

        if (serviceRequestTypeRepository.existsByNameIgnoreCase(name)) {
            throw new ConflictException("Já existe um tipo de atendimento com o nome informado.");
        }

        // Montar entidade com base na DTO
        ServiceRequestType serviceRequestType = new ServiceRequestType();
        serviceRequestType.setName(name);

        ServiceRequestType saved = serviceRequestTypeRepository.save(serviceRequestType);

        return toResponse(saved);
    }

    @Transactional
    public ServiceRequestTypeResponse update(Integer id, ServiceRequestTypeRequest request) {
        String name = request.name().trim();

        ServiceRequestType serviceRequestType = findByIdOrThrow(id);

        if (!serviceRequestType.isActive()) {
            throw new IllegalArgumentException("Não é possível editar um tipo de atendimento inativo.");
        }

        // Ignora o próprio registro para permitir salvar sem alterar o nome
        if (serviceRequestTypeRepository.existsByNameIgnoreCaseAndIdNot(name, id)) {
            throw new ConflictException("Já existe um tipo de atendimento com o nome informado.");
        }

        serviceRequestType.setName(name);

        return toResponse(serviceRequestType);
    }

    @Transactional
    public ServiceRequestTypeResponse deactivate(Integer id) {
        ServiceRequestType serviceRequestType = findByIdOrThrow(id);

        if (!serviceRequestType.isActive()) {
            throw new IllegalArgumentException("O tipo de atendimento já está inativo.");
        }

        serviceRequestType.setActive(false);

        return toResponse(serviceRequestType);
    }

    @Transactional
    public ServiceRequestTypeResponse reactivate(Integer id) {
        ServiceRequestType serviceRequestType = findByIdOrThrow(id);

        if (serviceRequestType.isActive()) {
            throw new IllegalArgumentException("O tipo de atendimento já está ativo.");
        }

        serviceRequestType.setActive(true);

        return toResponse(serviceRequestType);
    }

    private ServiceRequestType findByIdOrThrow(Integer id) {
        return serviceRequestTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado nenhum tipo de atendimento com o ID informado."));
    }

    private ServiceRequestTypeResponse toResponse(ServiceRequestType serviceRequestType) {
        return new ServiceRequestTypeResponse(
                serviceRequestType.getId(),
                serviceRequestType.getName(),
                serviceRequestType.isActive()
        );
    }
}
