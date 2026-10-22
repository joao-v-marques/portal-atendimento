package com.joao_v_marques.portal_atendimento.service_requests.service_request;

import com.joao_v_marques.portal_atendimento.exception.ConflictException;
import com.joao_v_marques.portal_atendimento.exception.ResourceNotFoundException;
import com.joao_v_marques.portal_atendimento.service_requests.category.ServiceRequestCategory;
import com.joao_v_marques.portal_atendimento.service_requests.category.ServiceRequestCategoryRepository;
import com.joao_v_marques.portal_atendimento.service_requests.channel.ServiceRequestChannel;
import com.joao_v_marques.portal_atendimento.service_requests.channel.ServiceRequestChannelRepository;
import com.joao_v_marques.portal_atendimento.service_requests.service_request.dto.ServiceRequestAssigneeResponse;
import com.joao_v_marques.portal_atendimento.service_requests.service_request.dto.ServiceRequestFinishRequest;
import com.joao_v_marques.portal_atendimento.service_requests.service_request.dto.ServiceRequestRequest;
import com.joao_v_marques.portal_atendimento.service_requests.service_request.dto.ServiceRequestResponse;
import com.joao_v_marques.portal_atendimento.service_requests.severity.ServiceRequestSeverity;
import com.joao_v_marques.portal_atendimento.service_requests.severity.ServiceRequestSeverityRepository;
import com.joao_v_marques.portal_atendimento.service_requests.status.ServiceRequestStatus;
import com.joao_v_marques.portal_atendimento.service_requests.status.ServiceRequestStatusRepository;
import com.joao_v_marques.portal_atendimento.service_requests.type.ServiceRequestType;
import com.joao_v_marques.portal_atendimento.service_requests.type.ServiceRequestTypeRepository;
import com.joao_v_marques.portal_atendimento.users.user.User;
import com.joao_v_marques.portal_atendimento.users.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
public class ServiceRequestService {

    // IDs dos status de sistema, na ordem do seed da V7
    private static final Integer STATUS_IN_PROGRESS_ID = 1;
    private static final Integer STATUS_FINISHED_ID = 2;

    // Role exigida do responsável pelo chamado (inserida na V7)
    private static final String ASSIGNEE_ROLE = "EMPLOYEE_RELATIONSHIP";

    private final ServiceRequestRepository serviceRequestRepository;
    private final ServiceRequestCategoryRepository serviceRequestCategoryRepository;
    private final ServiceRequestChannelRepository serviceRequestChannelRepository;
    private final ServiceRequestTypeRepository serviceRequestTypeRepository;
    private final ServiceRequestSeverityRepository serviceRequestSeverityRepository;
    private final ServiceRequestStatusRepository serviceRequestStatusRepository;
    private final UserRepository userRepository;

    public ServiceRequestService(ServiceRequestRepository serviceRequestRepository, ServiceRequestCategoryRepository serviceRequestCategoryRepository, ServiceRequestChannelRepository serviceRequestChannelRepository, ServiceRequestTypeRepository serviceRequestTypeRepository, ServiceRequestSeverityRepository serviceRequestSeverityRepository, ServiceRequestStatusRepository serviceRequestStatusRepository, UserRepository userRepository) {
        this.serviceRequestRepository = serviceRequestRepository;
        this.serviceRequestCategoryRepository = serviceRequestCategoryRepository;
        this.serviceRequestChannelRepository = serviceRequestChannelRepository;
        this.serviceRequestTypeRepository = serviceRequestTypeRepository;
        this.serviceRequestSeverityRepository = serviceRequestSeverityRepository;
        this.serviceRequestStatusRepository = serviceRequestStatusRepository;
        this.userRepository = userRepository;
    }

    // GET de todos os chamados, do mais recente para o mais antigo
    @Transactional(readOnly = true)
    public List<ServiceRequestResponse> findAll() {
        return serviceRequestRepository.findAllByOrderByOpenedAtDesc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ServiceRequestResponse findById(Integer id) {
        ServiceRequest serviceRequest = serviceRequestRepository.findWithDetailsById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado nenhum chamado com o ID informado."));

        return toResponse(serviceRequest);
    }

    // GET dos usuários que podem ser responsáveis: colaboradores do relacionamento ativos
    @Transactional(readOnly = true)
    public List<ServiceRequestAssigneeResponse> findAssignees() {
        return userRepository.findActiveByRoleName(ASSIGNEE_ROLE)
                .stream()
                .map(user -> new ServiceRequestAssigneeResponse(user.getId(), user.getName(), user.getUsername()))
                .toList();
    }

    @Transactional
    public ServiceRequestResponse create(ServiceRequestRequest request, Integer currentUserId) {
        String protocolNumber = request.protocolNumber().trim();

        if (serviceRequestRepository.existsByProtocolNumber(protocolNumber)) {
            throw new ConflictException("Já existe um chamado com o número de protocolo informado.");
        }

        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado usuário com o ID informado."));

        // Montar a entidade, o DTO nunca vira entidade sozinho. Na criação não há valor atual (null)
        ServiceRequest serviceRequest = new ServiceRequest();
        serviceRequest.setProtocolNumber(protocolNumber);
        applyRequest(serviceRequest, request);
        serviceRequest.setInsertedBy(currentUser);

        if (request.openedAt() != null) {
            serviceRequest.setOpenedAt(request.openedAt());
        }

        ServiceRequest saved = serviceRequestRepository.save(serviceRequest);

        return toResponse(saved);
    }

    @Transactional
    public ServiceRequestResponse update(Integer id, ServiceRequestRequest request, Integer currentUserId) {
        ServiceRequest serviceRequest = serviceRequestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado nenhum chamado com o ID informado."));

        if (STATUS_FINISHED_ID.equals(serviceRequest.getStatus().getId())) {
            throw new IllegalArgumentException("Não é possível editar um chamado finalizado. Reabra o chamado antes de editar.");
        }

        String protocolNumber = request.protocolNumber().trim();

        // Ignora o próprio registro para permitir salvar sem alterar o protocolo
        if (serviceRequestRepository.existsByProtocolNumberAndIdNot(protocolNumber, id)) {
            throw new ConflictException("Já existe um chamado com o número de protocolo informado.");
        }

        serviceRequest.setProtocolNumber(protocolNumber);
        applyRequest(serviceRequest, request);

        if (request.openedAt() != null) {
            serviceRequest.setOpenedAt(request.openedAt());
        }

        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado usuário com o ID informado."));

        serviceRequest.setUpdatedBy(currentUser);
        serviceRequest.setUpdatedAt(OffsetDateTime.now());

        return toResponse(serviceRequest);
    }

    // PATCH para finalizar: único caminho para o status Finalizado, para closed_at e resolution ficarem consistentes
    @Transactional
    public ServiceRequestResponse finish(Integer id, ServiceRequestFinishRequest request, Integer currentUserId) {
        ServiceRequest serviceRequest = serviceRequestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado nenhum chamado com o ID informado."));

        if (STATUS_FINISHED_ID.equals(serviceRequest.getStatus().getId())) {
            throw new IllegalArgumentException("Este chamado já está finalizado.");
        }

        // Status de sistema: não passa pela regra de inativo, senão o fluxo travaria
        ServiceRequestStatus finishedStatus = serviceRequestStatusRepository.findById(STATUS_FINISHED_ID)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado o status de atendimento com o ID " + STATUS_FINISHED_ID + "."));

        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado usuário com o ID informado."));

        serviceRequest.setStatus(finishedStatus);
        serviceRequest.setResolution(request.resolution().trim());
        serviceRequest.setClosedAt(OffsetDateTime.now());
        serviceRequest.setUpdatedBy(currentUser);
        serviceRequest.setUpdatedAt(OffsetDateTime.now());

        return toResponse(serviceRequest);
    }

    // PATCH para reabrir: volta para Em andamento e limpa o closed_at. A resolução é mantida até a próxima finalização
    @Transactional
    public ServiceRequestResponse reopen(Integer id, Integer currentUserId) {
        ServiceRequest serviceRequest = serviceRequestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado nenhum chamado com o ID informado."));

        if (!STATUS_FINISHED_ID.equals(serviceRequest.getStatus().getId())) {
            throw new IllegalArgumentException("Só é possível reabrir um chamado finalizado.");
        }

        // Status de sistema: não passa pela regra de inativo, senão o fluxo travaria
        ServiceRequestStatus inProgressStatus = serviceRequestStatusRepository.findById(STATUS_IN_PROGRESS_ID)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado o status de atendimento com o ID " + STATUS_IN_PROGRESS_ID + "."));

        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado usuário com o ID informado."));

        serviceRequest.setStatus(inProgressStatus);
        serviceRequest.setClosedAt(null);
        serviceRequest.setUpdatedBy(currentUser);
        serviceRequest.setUpdatedAt(OffsetDateTime.now());

        return toResponse(serviceRequest);
    }

    // Aplica os campos comuns de POST e PUT. Relações inativas só são recusadas quando o valor muda
    private void applyRequest(ServiceRequest serviceRequest, ServiceRequestRequest request) {
        if (STATUS_FINISHED_ID.equals(request.statusId())) {
            throw new IllegalArgumentException("Para finalizar o chamado, use a finalização do chamado.");
        }

        ServiceRequestCategory category = serviceRequest.getCategory();
        if (category == null || !category.getId().equals(request.categoryId())) {
            category = serviceRequestCategoryRepository.findById(request.categoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrada nenhuma categoria de atendimento com o ID informado."));

            if (!category.isActive()) {
                throw new IllegalArgumentException("Não é possível usar uma categoria de atendimento inativa.");
            }

            serviceRequest.setCategory(category);
        }

        ServiceRequestChannel channel = serviceRequest.getChannel();
        if (channel == null || !channel.getId().equals(request.channelId())) {
            channel = serviceRequestChannelRepository.findById(request.channelId())
                    .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado nenhum canal de atendimento com o ID informado."));

            if (!channel.isActive()) {
                throw new IllegalArgumentException("Não é possível usar um canal de atendimento inativo.");
            }

            serviceRequest.setChannel(channel);
        }

        ServiceRequestType type = serviceRequest.getType();
        if (type == null || !type.getId().equals(request.typeId())) {
            type = serviceRequestTypeRepository.findById(request.typeId())
                    .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado nenhum tipo de atendimento com o ID informado."));

            if (!type.isActive()) {
                throw new IllegalArgumentException("Não é possível usar um tipo de atendimento inativo.");
            }

            serviceRequest.setType(type);
        }

        // Severidade é opcional: id nulo remove a severidade do chamado
        ServiceRequestSeverity severity = serviceRequest.getSeverity();
        if (request.severityId() == null) {
            serviceRequest.setSeverity(null);
        } else if (severity == null || !severity.getId().equals(request.severityId())) {
            severity = serviceRequestSeverityRepository.findById(request.severityId())
                    .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrada nenhuma severidade com o ID informado."));

            if (!severity.isActive()) {
                throw new IllegalArgumentException("Não é possível usar uma severidade inativa.");
            }

            serviceRequest.setSeverity(severity);
        }

        ServiceRequestStatus status = serviceRequest.getStatus();
        if (status == null || !status.getId().equals(request.statusId())) {
            status = serviceRequestStatusRepository.findById(request.statusId())
                    .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado nenhum status de atendimento com o ID informado."));

            if (!status.isActive()) {
                throw new IllegalArgumentException("Não é possível usar um status de atendimento inativo.");
            }

            serviceRequest.setStatus(status);
        }

        serviceRequest.setAssignedTo(resolveAssignee(request.assignedToId(), serviceRequest.getAssignedTo()));

        serviceRequest.setRequesterCardNumber(request.requesterCardNumber().trim());
        serviceRequest.setRequesterName(request.requesterName().trim());
        // Campos opcionais em branco viram null, para não gravar "" no banco
        serviceRequest.setRequesterCpf(request.requesterCpf() == null || request.requesterCpf().isBlank() ? null : request.requesterCpf().trim());
        serviceRequest.setRequesterBirthDate(request.requesterBirthDate());
        serviceRequest.setRequesterPhone(request.requesterPhone() == null || request.requesterPhone().isBlank() ? null : request.requesterPhone().trim());
        serviceRequest.setRequesterEmail(request.requesterEmail() == null || request.requesterEmail().isBlank() ? null : request.requesterEmail().trim());
        serviceRequest.setDescription(request.description().trim());
    }

    private User resolveAssignee(Integer id, User current) {
        if (current != null && current.getId().equals(id)) {
            return current;
        }

        User assignee = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado nenhum usuário responsável com o ID informado."));

        if (!assignee.isActive()) {
            throw new IllegalArgumentException("Não é possível atribuir o chamado a um usuário inativo.");
        }
        if (!ASSIGNEE_ROLE.equals(assignee.getRole().getName())) {
            throw new IllegalArgumentException("O responsável pelo chamado deve ser um colaborador do relacionamento.");
        }

        return assignee;
    }

    private ServiceRequestResponse toResponse(ServiceRequest serviceRequest) {
        ServiceRequestSeverity severity = serviceRequest.getSeverity();
        User updatedBy = serviceRequest.getUpdatedBy();

        return new ServiceRequestResponse(
                serviceRequest.getId(),
                serviceRequest.getProtocolNumber(),
                serviceRequest.getCategory().getId(),
                serviceRequest.getCategory().getName(),
                serviceRequest.getChannel().getId(),
                serviceRequest.getChannel().getName(),
                serviceRequest.getType().getId(),
                serviceRequest.getType().getName(),
                severity != null ? severity.getId() : null,
                severity != null ? severity.getName() : null,
                serviceRequest.getStatus().getId(),
                serviceRequest.getStatus().getName(),
                serviceRequest.getRequesterCardNumber(),
                serviceRequest.getRequesterName(),
                serviceRequest.getRequesterCpf(),
                serviceRequest.getRequesterBirthDate(),
                serviceRequest.getRequesterPhone(),
                serviceRequest.getRequesterEmail(),
                serviceRequest.getDescription(),
                serviceRequest.getResolution(),
                serviceRequest.getAssignedTo().getId(),
                serviceRequest.getAssignedTo().getName(),
                serviceRequest.getOpenedAt(),
                serviceRequest.getClosedAt(),
                serviceRequest.getInsertedBy().getName(),
                updatedBy != null ? updatedBy.getName() : null,
                serviceRequest.getCreatedAt(),
                serviceRequest.getUpdatedAt()
        );
    }
}
