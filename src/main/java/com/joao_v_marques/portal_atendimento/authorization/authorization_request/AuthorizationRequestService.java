package com.joao_v_marques.portal_atendimento.authorization.authorization_request;

import com.joao_v_marques.portal_atendimento.authorization.authorization_request.dto.AuthorizationRequestRequest;
import com.joao_v_marques.portal_atendimento.authorization.authorization_request.dto.AuthorizationRequestResponse;
import com.joao_v_marques.portal_atendimento.authorization.authorization_status.AuthorizationStatus;
import com.joao_v_marques.portal_atendimento.authorization.authorization_status.AuthorizationStatusRepository;
import com.joao_v_marques.portal_atendimento.authorization.authorization_type.AuthorizationType;
import com.joao_v_marques.portal_atendimento.authorization.authorization_type.AuthorizationTypeRepository;
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
                .orElseThrow(() -> new IllegalArgumentException("Não foi encontrado tipo de autorização com o ID informado."));
        AuthorizationStatus authorizationStatus = authorizationStatusRepository.findById(request.authorizationStatusId())
                .orElseThrow(() -> new IllegalArgumentException("Não foi encontrado tipo de autorização com o ID informado."));
        User user = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("Não foi encontrado usuário com o ID informado."));

        if (!authorizationType.isActive()) {
            throw new IllegalArgumentException("Não é possível realizar o cadastro de uma autorização com o tipo inativo.");
        }
        if (!authorizationStatus.isActive()) {
            throw new IllegalArgumentException("Não é possível realizar o cadastro de uma autorização com o status inativo.");
        }

        String transactionNumber = request.transactionNumber().trim();

        if (authorizationRequestRepository.existsByTransactionNumber(transactionNumber)) {
            throw new IllegalArgumentException("Já existe uma autorização com este número de transação.");
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

    private AuthorizationRequestResponse toResponse(AuthorizationRequest authorizationRequest) {
        return new AuthorizationRequestResponse(
                authorizationRequest.getId(),
                authorizationRequest.getTransactionNumber(),
                authorizationRequest.getRequestDate(),
                authorizationRequest.getAuthorizationType(),
                authorizationRequest.getAuthorizationStatus(),
                authorizationRequest.getBeneficiaryName(),
                authorizationRequest.getBeneficiaryPhone(),
                authorizationRequest.getCreatedAt(),
                authorizationRequest.getInsertedBy()
        );
    }
}
