package com.joao_v_marques.portal_atendimento.service_requests.status;

import com.joao_v_marques.portal_atendimento.exception.ConflictException;
import com.joao_v_marques.portal_atendimento.exception.ResourceNotFoundException;
import com.joao_v_marques.portal_atendimento.service_requests.status.dto.ServiceRequestStatusRequest;
import com.joao_v_marques.portal_atendimento.service_requests.status.dto.ServiceRequestStatusResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ServiceRequestStatusService {

    private final ServiceRequestStatusRepository serviceRequestStatusRepository;

    public ServiceRequestStatusService(ServiceRequestStatusRepository serviceRequestStatusRepository) {
        this.serviceRequestStatusRepository = serviceRequestStatusRepository;
    }

    @Transactional(readOnly = true)
    public List<ServiceRequestStatusResponse> findAll() {
        return serviceRequestStatusRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ServiceRequestStatusResponse create(ServiceRequestStatusRequest request) {
        String name = request.name().trim();

        if (serviceRequestStatusRepository.existsByNameIgnoreCase(name)) {
            throw new ConflictException("Já existe um status de atendimento com o nome informado.");
        }

        // Montar entidade com base na DTO
        ServiceRequestStatus serviceRequestStatus = new ServiceRequestStatus();
        serviceRequestStatus.setName(name);

        ServiceRequestStatus saved = serviceRequestStatusRepository.save(serviceRequestStatus);

        return toResponse(saved);
    }

    @Transactional
    public ServiceRequestStatusResponse update(Integer id, ServiceRequestStatusRequest request) {
        String name = request.name().trim();

        ServiceRequestStatus serviceRequestStatus = findByIdOrThrow(id);

        if (!serviceRequestStatus.isActive()) {
            throw new IllegalArgumentException("Não é possível editar um status de atendimento inativo.");
        }

        // Ignora o próprio registro para permitir salvar sem alterar o nome
        if (serviceRequestStatusRepository.existsByNameIgnoreCaseAndIdNot(name, id)) {
            throw new ConflictException("Já existe um status de atendimento com o nome informado.");
        }

        serviceRequestStatus.setName(name);

        return toResponse(serviceRequestStatus);
    }

    @Transactional
    public ServiceRequestStatusResponse deactivate(Integer id) {
        ServiceRequestStatus serviceRequestStatus = findByIdOrThrow(id);

        if (!serviceRequestStatus.isActive()) {
            throw new IllegalArgumentException("O status de atendimento já está inativo.");
        }

        serviceRequestStatus.setActive(false);

        return toResponse(serviceRequestStatus);
    }

    @Transactional
    public ServiceRequestStatusResponse reactivate(Integer id) {
        ServiceRequestStatus serviceRequestStatus = findByIdOrThrow(id);

        if (serviceRequestStatus.isActive()) {
            throw new IllegalArgumentException("O status de atendimento já está ativo.");
        }

        serviceRequestStatus.setActive(true);

        return toResponse(serviceRequestStatus);
    }

    private ServiceRequestStatus findByIdOrThrow(Integer id) {
        return serviceRequestStatusRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado nenhum status de atendimento com o ID informado."));
    }

    private ServiceRequestStatusResponse toResponse(ServiceRequestStatus serviceRequestStatus) {
        return new ServiceRequestStatusResponse(
                serviceRequestStatus.getId(),
                serviceRequestStatus.getName(),
                serviceRequestStatus.isActive()
        );
    }
}
