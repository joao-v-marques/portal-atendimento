package com.joao_v_marques.portal_atendimento.service_requests.channel;

import com.joao_v_marques.portal_atendimento.exception.ConflictException;
import com.joao_v_marques.portal_atendimento.exception.ResourceNotFoundException;
import com.joao_v_marques.portal_atendimento.service_requests.channel.dto.ServiceRequestChannelRequest;
import com.joao_v_marques.portal_atendimento.service_requests.channel.dto.ServiceRequestChannelResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ServiceRequestChannelService {

    private final ServiceRequestChannelRepository serviceRequestChannelRepository;

    public ServiceRequestChannelService(ServiceRequestChannelRepository serviceRequestChannelRepository) {
        this.serviceRequestChannelRepository = serviceRequestChannelRepository;
    }

    @Transactional(readOnly = true)
    public List<ServiceRequestChannelResponse> findAll() {
        return serviceRequestChannelRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ServiceRequestChannelResponse create(ServiceRequestChannelRequest request) {
        String name = request.name().trim();

        if (serviceRequestChannelRepository.existsByNameIgnoreCase(name)) {
            throw new ConflictException("Já existe um canal de atendimento com o nome informado.");
        }

        // Montar entidade com base na DTO
        ServiceRequestChannel serviceRequestChannel = new ServiceRequestChannel();
        serviceRequestChannel.setName(name);

        ServiceRequestChannel saved = serviceRequestChannelRepository.save(serviceRequestChannel);

        return toResponse(saved);
    }

    @Transactional
    public ServiceRequestChannelResponse update(Integer id, ServiceRequestChannelRequest request) {
        String name = request.name().trim();

        ServiceRequestChannel serviceRequestChannel = findByIdOrThrow(id);

        if (!serviceRequestChannel.isActive()) {
            throw new IllegalArgumentException("Não é possível editar um canal de atendimento inativo.");
        }

        // Ignora o próprio registro para permitir salvar sem alterar o nome
        if (serviceRequestChannelRepository.existsByNameIgnoreCaseAndIdNot(name, id)) {
            throw new ConflictException("Já existe um canal de atendimento com o nome informado.");
        }

        serviceRequestChannel.setName(name);

        return toResponse(serviceRequestChannel);
    }

    @Transactional
    public ServiceRequestChannelResponse deactivate(Integer id) {
        ServiceRequestChannel serviceRequestChannel = findByIdOrThrow(id);

        if (!serviceRequestChannel.isActive()) {
            throw new IllegalArgumentException("O canal de atendimento já está inativo.");
        }

        serviceRequestChannel.setActive(false);

        return toResponse(serviceRequestChannel);
    }

    @Transactional
    public ServiceRequestChannelResponse reactivate(Integer id) {
        ServiceRequestChannel serviceRequestChannel = findByIdOrThrow(id);

        if (serviceRequestChannel.isActive()) {
            throw new IllegalArgumentException("O canal de atendimento já está ativo.");
        }

        serviceRequestChannel.setActive(true);

        return toResponse(serviceRequestChannel);
    }

    private ServiceRequestChannel findByIdOrThrow(Integer id) {
        return serviceRequestChannelRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado nenhum canal de atendimento com o ID informado."));
    }

    private ServiceRequestChannelResponse toResponse(ServiceRequestChannel serviceRequestChannel) {
        return new ServiceRequestChannelResponse(
                serviceRequestChannel.getId(),
                serviceRequestChannel.getName(),
                serviceRequestChannel.isActive()
        );
    }
}
