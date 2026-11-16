package com.joao_v_marques.portal_atendimento.authorization.authorization_request;

import com.joao_v_marques.portal_atendimento.authorization.authorization_request.dto.AuthorizationRequestRequest;
import com.joao_v_marques.portal_atendimento.authorization.authorization_request.dto.AuthorizationRequestResponse;
import com.joao_v_marques.portal_atendimento.authorization.authorization_status.AuthorizationStatus;
import com.joao_v_marques.portal_atendimento.authorization.authorization_status.AuthorizationStatusRepository;
import com.joao_v_marques.portal_atendimento.authorization.authorization_type.AuthorizationType;
import com.joao_v_marques.portal_atendimento.authorization.authorization_type.AuthorizationTypeRepository;
import com.joao_v_marques.portal_atendimento.exception.ConflictException;
import com.joao_v_marques.portal_atendimento.exception.ResourceNotFoundException;
import com.joao_v_marques.portal_atendimento.users.user.User;
import com.joao_v_marques.portal_atendimento.authorization.authorization_request_document.AuthorizationRequestDocumentService;
import com.joao_v_marques.portal_atendimento.users.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class AuthorizationRequestService {

    private final AuthorizationRequestRepository authorizationRequestRepository;
    private final AuthorizationTypeRepository authorizationTypeRepository;
    private final AuthorizationStatusRepository authorizationStatusRepository;
    private final UserRepository userRepository;
    private final AuthorizationRequestDocumentService authorizationRequestDocumentService;

    public AuthorizationRequestService(AuthorizationRequestRepository authorizationRequestRepository, AuthorizationTypeRepository authorizationTypeRepository, AuthorizationStatusRepository authorizationStatusRepository, UserRepository userRepository, AuthorizationRequestDocumentService authorizationRequestDocumentService) {
        this.authorizationRequestRepository = authorizationRequestRepository;
        this.authorizationTypeRepository = authorizationTypeRepository;
        this.authorizationStatusRepository = authorizationStatusRepository;
        this.userRepository = userRepository;
        this.authorizationRequestDocumentService = authorizationRequestDocumentService;
    }

    // GET de todas as autorizações cadastradas
    @Transactional(readOnly = true)
    public List<AuthorizationRequestResponse> findAll() {
        return authorizationRequestRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public AuthorizationRequestResponse create(AuthorizationRequestRequest request, List<MultipartFile> files, Integer currentUserId) {
        // Valida as FK's e retorna erro se não existir
        AuthorizationType authorizationType = authorizationTypeRepository.findById(request.authorizationTypeId())
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado tipo de autorização com o ID informado."));
        AuthorizationStatus authorizationStatus = authorizationStatusRepository.findById(request.authorizationStatusId())
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado tipo de autorização com o ID informado."));
        User user = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado usuário com o ID informado."));

        if (!authorizationType.isActive()) {
            throw new IllegalArgumentException("Não é possível realizar o cadastro de uma autorização com o tipo inativo.");
        }
        if (!authorizationStatus.isActive()) {
            throw new IllegalArgumentException("Não é possível realizar o cadastro de uma autorização com o status inativo.");
        }

        String transactionNumber = request.transactionNumber().trim();

        if (authorizationRequestRepository.existsByTransactionNumber(transactionNumber)) {
            throw new ConflictException("Já existe uma autorização com este número de transação.");
        }

        LocalDate requestDate = request.requestDate();
        String beneficiaryName = request.beneficiaryName().trim();
        String beneficiaryPhone = request.beneficiaryPhone().trim();

        // Montar a entidade, o DTO nunca vira entidade sozinho
        AuthorizationRequest authorizationRequest = new AuthorizationRequest();
        authorizationRequest.setTransactionNumber(transactionNumber);
        authorizationRequest.setRequestDate(requestDate);
        authorizationRequest.setAuthorizationType(authorizationType);
        authorizationRequest.setAuthorizationStatus(authorizationStatus);
        authorizationRequest.setBeneficiaryName(beneficiaryName);
        authorizationRequest.setBeneficiaryPhone(beneficiaryPhone);
        authorizationRequest.setInsertedBy(user);

        AuthorizationRequest saved = authorizationRequestRepository.save(authorizationRequest);

        // Mesma transação: se um documento falhar, a autorização não é criada
        authorizationRequestDocumentService.attachAll(saved, files, user);

        return toResponse(saved);
    }

    @Transactional
    public AuthorizationRequestResponse finishAuthorization(Integer authorizationId) {
        AuthorizationRequest authorizationRequest = authorizationRequestRepository.findByIdForUpdate(authorizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado nenhuma autorização com o ID informado."));
        AuthorizationStatus authorizationStatus = authorizationStatusRepository.findById(2)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado nenhum status para autorização com o ID 2."));

        if (!authorizationStatus.isActive()) {
            throw new IllegalArgumentException("Não é possível alterar para um status inativo");
        }
        if (authorizationRequest.getAuthorizationStatus().getId().equals(2)) {
            throw new IllegalArgumentException("Este pedido já está finalizado");
        }

        authorizationRequest.setAuthorizationStatus(authorizationStatus);
        authorizationRequest.setFinishDate(LocalDate.now());

        return toResponse(authorizationRequest);
    }

    @Transactional
    public AuthorizationRequestResponse reopenAuthorization(Integer authorizationId) {
        AuthorizationRequest authorizationRequest = authorizationRequestRepository.findByIdForUpdate(authorizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado nenhuma autorização com o ID informado."));
        AuthorizationStatus authorizationStatus = authorizationStatusRepository.findById(1)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado nenhum status de autorização com o ID informado."));

        if (!authorizationStatus.isActive()) {
            throw new IllegalArgumentException("Não é possível alterar para um status inativo.");
        }
        if (authorizationRequest.getAuthorizationStatus().getId().equals(1)) {
            throw new IllegalArgumentException("Este pedido já está ativo.");
        }

        authorizationRequest.setAuthorizationStatus(authorizationStatus);
        authorizationRequest.setFinishDate(null);

        return toResponse(authorizationRequest);
    }

    // Função para atualizar as informações da autorização (Não incluí documentos)
    @Transactional
    public AuthorizationRequestResponse update(Integer authorizationId, AuthorizationRequestRequest request) {
        // Validar se de fato a autorização existe
        AuthorizationRequest authorizationRequest = authorizationRequestRepository.findById(authorizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado autorização com o ID informado."));
        AuthorizationType authorizationType = authorizationTypeRepository.findById(request.authorizationTypeId())
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado tipo de autorização com o ID informado."));

        // Só bloqueia tipo inativo quando ele está sendo trocado; manter o tipo atual é permitido
        if (!authorizationType.isActive() && !authorizationType.getId().equals(authorizationRequest.getAuthorizationType().getId())) {
            throw new IllegalArgumentException("Não é possível alterar a autorização para um tipo inativo.");
        }

        String transactionNumber = request.transactionNumber().trim();

        // Ignora a própria autorização para permitir salvar sem alterar o número da transação
        if (authorizationRequestRepository.existsByTransactionNumberAndIdNot(transactionNumber, authorizationId)) {
            throw new ConflictException("Já existe uma autorização com este número de transação.");
        }

        // Status e data de finalização não mudam aqui: ficam com /finish e /reopen
        authorizationRequest.setTransactionNumber(transactionNumber);
        authorizationRequest.setRequestDate(request.requestDate());
        authorizationRequest.setAuthorizationType(authorizationType);
        authorizationRequest.setBeneficiaryName(request.beneficiaryName().trim());
        authorizationRequest.setBeneficiaryPhone(request.beneficiaryPhone().trim());

        return toResponse(authorizationRequest);
    }

    private AuthorizationRequestResponse toResponse(AuthorizationRequest authorizationRequest) {
        return new AuthorizationRequestResponse(
                authorizationRequest.getId(),
                authorizationRequest.getTransactionNumber(),
                authorizationRequest.getRequestDate(),
                authorizationRequest.getFinishDate(),
                authorizationRequest.getAuthorizationType().getId(),
                authorizationRequest.getAuthorizationType().getName(),
                authorizationRequest.getAuthorizationType().getMaxDays(),
                authorizationRequest.getAuthorizationStatus().getId(),
                authorizationRequest.getAuthorizationStatus().getName(),
                authorizationRequest.getBeneficiaryName(),
                authorizationRequest.getBeneficiaryPhone(),
                authorizationRequest.getCreatedAt(),
                authorizationRequest.getInsertedBy().getName()
        );
    }
}
