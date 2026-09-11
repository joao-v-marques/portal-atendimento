package com.joao_v_marques.portal_atendimento.authorization.authorization_request_document;

import com.joao_v_marques.portal_atendimento.authorization.authorization_request.AuthorizationRequestRepository;
import com.joao_v_marques.portal_atendimento.authorization.authorization_request_document.dto.AuthorizationRequestDocumentResponse;
import com.joao_v_marques.portal_atendimento.storage.DocumentStorage;
import com.joao_v_marques.portal_atendimento.storage.FileTypeValidator;
import com.joao_v_marques.portal_atendimento.storage.StorageProperties;
import com.joao_v_marques.portal_atendimento.users.user.User;
import com.joao_v_marques.portal_atendimento.users.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AuthorizationRequestDocumentService {

    private final AuthorizationRequestDocumentRepository documentRepository;
    private final AuthorizationRequestRepository authorizationRequestRepository;
    private final UserRepository userRepository;
    private final DocumentStorage documentStorage;
    private final FileTypeValidator fileTypeValidator;
    private final StorageProperties storageProperties;

    public AuthorizationRequestDocumentService(
            AuthorizationRequestDocumentRepository documentRepository,
            AuthorizationRequestRepository authorizationRequestRepository,
            UserRepository userRepository,
            DocumentStorage documentStorage,
            FileTypeValidator fileTypeValidator,
            StorageProperties storageProperties) {
        this.documentRepository = documentRepository;
        this.authorizationRequestRepository = authorizationRequestRepository;
        this.userRepository = userRepository;
        this.documentStorage = documentStorage;
        this.fileTypeValidator = fileTypeValidator;
        this.storageProperties = storageProperties;
    }

    @Transactional(readOnly = true)
    public List<AuthorizationRequestDocumentResponse> findByRequest(Integer requestId) {
        if (!authorizationRequestRepository.existsById(requestId)) {
            throw new IllegalArgumentException("Não foi encontrada autorização com o ID informado.");
        }
        return documentRepository.findByAuthorizationRequestId(requestId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private AuthorizationRequestDocumentResponse toResponse(AuthorizationRequestDocument authorizationRequestDocument) {
        User uploadedBy = authorizationRequestDocument.getUploadedBy();

        return new AuthorizationRequestDocumentResponse(
                authorizationRequestDocument.getId(),
                authorizationRequestDocument.getOriginalFilename(),
                authorizationRequestDocument.getContentType(),
                authorizationRequestDocument.getSizeBytes(),
                authorizationRequestDocument.getUploadedAt(),
                uploadedBy.getId(),
                uploadedBy.getName()
        );
    }
}
