package com.joao_v_marques.portal_atendimento.authorization.authorization_request_document;

import com.joao_v_marques.portal_atendimento.authorization.authorization_request.AuthorizationRequest;
import com.joao_v_marques.portal_atendimento.authorization.authorization_request.AuthorizationRequestRepository;
import com.joao_v_marques.portal_atendimento.authorization.authorization_request_document.dto.AuthorizationRequestDocumentResponse;
import com.joao_v_marques.portal_atendimento.storage.AllowedFileType;
import com.joao_v_marques.portal_atendimento.storage.DocumentStorage;
import com.joao_v_marques.portal_atendimento.storage.FileTypeValidator;
import com.joao_v_marques.portal_atendimento.storage.PathSanitizer;
import com.joao_v_marques.portal_atendimento.storage.StorageProperties;
import com.joao_v_marques.portal_atendimento.users.user.User;
import com.joao_v_marques.portal_atendimento.users.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AuthorizationRequestDocumentService {

    private static final int MAX_COLLISION_ATTEMPTS = 100;

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

    // Monta <beneficiário>/<transaction_number>/<nome original>.<extensão detectada>
    private String buildRelativePath(AuthorizationRequest request, String originalFilename, AllowedFileType type) {
        String beneficiary = PathSanitizer.sanitize(request.getBeneficiaryName());
        String transaction = PathSanitizer.sanitize(request.getTransactionNumber());
        String baseName = PathSanitizer.sanitize(baseNameOf(originalFilename));

        String directory = beneficiary + "/" + transaction;

        return resolveCollision(directory, baseName, type.getExtension());
    }

    // Descarta diretório antes da extensão: alguns navegadores mandam o caminho completo
    private String baseNameOf(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) {
            return "documento";
        }

        int lastSeparator = Math.max(originalFilename.lastIndexOf('/'), originalFilename.lastIndexOf('\\'));
        String fileName = originalFilename.substring(lastSeparator + 1);

        int lastDot = fileName.lastIndexOf('.');
        return lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
    }

    // Checagem otimista. A garantia real é a UNIQUE em stored_path e o Files.copy sem REPLACE_EXISTING.
    private String resolveCollision(String directory, String baseName, String extension) {
        String candidate = directory + "/" + baseName + "." + extension;

        for (int counter = 2; documentRepository.existsByStoredPath(candidate); counter++) {
            if (counter > MAX_COLLISION_ATTEMPTS) {
                throw new IllegalArgumentException("Não foi possível gerar um nome único para o arquivo.");
            }
            candidate = directory + "/" + baseName + " (" + counter + ")." + extension;
        }

        return candidate;
    }
}
