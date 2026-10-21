package com.joao_v_marques.portal_atendimento.service_requests.category;

import com.joao_v_marques.portal_atendimento.exception.ConflictException;
import com.joao_v_marques.portal_atendimento.exception.ResourceNotFoundException;
import com.joao_v_marques.portal_atendimento.service_requests.category.dto.ServiceRequestCategoryRequest;
import com.joao_v_marques.portal_atendimento.service_requests.category.dto.ServiceRequestCategoryResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ServiceRequestCategoryService {

    private final ServiceRequestCategoryRepository serviceRequestCategoryRepository;

    public ServiceRequestCategoryService(ServiceRequestCategoryRepository serviceRequestCategoryRepository) {
        this.serviceRequestCategoryRepository = serviceRequestCategoryRepository;
    }

    @Transactional(readOnly = true)
    public List<ServiceRequestCategoryResponse> findAll() {
        return serviceRequestCategoryRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ServiceRequestCategoryResponse create(ServiceRequestCategoryRequest request) {
        String name = request.name().trim();

        if (serviceRequestCategoryRepository.existsByNameIgnoreCase(name)) {
            throw new ConflictException("Já existe uma categoria de atendimento com o nome informado.");
        }

        // Montar entidade com base na DTO
        ServiceRequestCategory serviceRequestCategory = new ServiceRequestCategory();
        serviceRequestCategory.setName(name);

        ServiceRequestCategory saved = serviceRequestCategoryRepository.save(serviceRequestCategory);

        return toResponse(saved);
    }

    @Transactional
    public ServiceRequestCategoryResponse update(Integer id, ServiceRequestCategoryRequest request) {
        String name = request.name().trim();

        ServiceRequestCategory serviceRequestCategory = findByIdOrThrow(id);

        if (!serviceRequestCategory.isActive()) {
            throw new IllegalArgumentException("Não é possível editar uma categoria de atendimento inativa.");
        }

        // Ignora o próprio registro para permitir salvar sem alterar o nome
        if (serviceRequestCategoryRepository.existsByNameIgnoreCaseAndIdNot(name, id)) {
            throw new ConflictException("Já existe uma categoria de atendimento com o nome informado.");
        }

        serviceRequestCategory.setName(name);

        return toResponse(serviceRequestCategory);
    }

    @Transactional
    public ServiceRequestCategoryResponse deactivate(Integer id) {
        ServiceRequestCategory serviceRequestCategory = findByIdOrThrow(id);

        if (!serviceRequestCategory.isActive()) {
            throw new IllegalArgumentException("A categoria de atendimento já está inativa.");
        }

        serviceRequestCategory.setActive(false);

        return toResponse(serviceRequestCategory);
    }

    @Transactional
    public ServiceRequestCategoryResponse reactivate(Integer id) {
        ServiceRequestCategory serviceRequestCategory = findByIdOrThrow(id);

        if (serviceRequestCategory.isActive()) {
            throw new IllegalArgumentException("A categoria de atendimento já está ativa.");
        }

        serviceRequestCategory.setActive(true);

        return toResponse(serviceRequestCategory);
    }

    private ServiceRequestCategory findByIdOrThrow(Integer id) {
        return serviceRequestCategoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrada nenhuma categoria de atendimento com o ID informado."));
    }

    private ServiceRequestCategoryResponse toResponse(ServiceRequestCategory serviceRequestCategory) {
        return new ServiceRequestCategoryResponse(
                serviceRequestCategory.getId(),
                serviceRequestCategory.getName(),
                serviceRequestCategory.isActive()
        );
    }
}
