package com.joao_v_marques.portal_atendimento.authorization.authorization_request_document;

import com.joao_v_marques.portal_atendimento.authorization.authorization_request.AuthorizationRequest;
import com.joao_v_marques.portal_atendimento.authorization.authorization_request.AuthorizationRequestRepository;
import com.joao_v_marques.portal_atendimento.authorization.authorization_request_document.dto.AuthorizationRequestDocumentResponse;
import com.joao_v_marques.portal_atendimento.exception.StorageException;
import com.joao_v_marques.portal_atendimento.storage.AllowedFileType;
import com.joao_v_marques.portal_atendimento.storage.DocumentStorage;
import com.joao_v_marques.portal_atendimento.storage.FileTypeValidator;
import com.joao_v_marques.portal_atendimento.storage.PathSanitizer;
import com.joao_v_marques.portal_atendimento.storage.StorageProperties;
import com.joao_v_marques.portal_atendimento.users.user.User;
import com.joao_v_marques.portal_atendimento.users.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
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

    // Monta <transaction_number>/<nome original>.<extensão detectada>
    private String buildRelativePath(AuthorizationRequest request, String originalFilename, AllowedFileType type) {
        String directory = PathSanitizer.sanitize(request.getTransactionNumber());
        String baseName = PathSanitizer.sanitize(baseNameOf(originalFilename));

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

    // Anexo avulso: carrega as entidades por id e delega para o attach
    @Transactional
    public AuthorizationRequestDocumentResponse upload(Integer requestId, MultipartFile file, Integer currentUserId) {
        AuthorizationRequest request = authorizationRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Não foi encontrada autorização com o ID informado."));

        User user = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("Não foi encontrado usuário com o ID informado."));

        if (documentRepository.countByAuthorizationRequestId(requestId) >= storageProperties.maxFilesPerRequest()) {
            throw new IllegalArgumentException(
                    "Esta autorização já atingiu o limite de " + storageProperties.maxFilesPerRequest() + " documentos.");
        }

        return toResponse(attach(request, file, user));
    }

    // Usado pela criação atômica. Documentos são opcionais, por isso o retorno silencioso.
    public void attachAll(AuthorizationRequest request, List<MultipartFile> files, User user) {
        if (files == null || files.isEmpty()) {
            return;
        }

        if (files.size() > storageProperties.maxFilesPerRequest()) {
            throw new IllegalArgumentException(
                    "Envie no máximo " + storageProperties.maxFilesPerRequest() + " documentos.");
        }

        files.forEach(file -> attach(request, file, user));
    }

    // Núcleo compartilhado pelos dois fluxos. Sem @Transactional: sempre roda dentro da
    // transação do chamador, e o registerRollbackCleanup falha alto se não houver uma.
    AuthorizationRequestDocument attach(AuthorizationRequest request, MultipartFile file, User user) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Envie um arquivo.");
        }

        // BufferedInputStream é o que dá mark/reset para o FileTypeValidator
        try (InputStream content = new BufferedInputStream(file.getInputStream())) {

            AllowedFileType type = fileTypeValidator.detect(content)
                    .orElseThrow(() -> new IllegalArgumentException("Envie apenas PDF, JPEG ou PNG."));

            String relativePath = buildRelativePath(request, file.getOriginalFilename(), type);

            documentStorage.store(content, relativePath);
            // Registrar DEPOIS do store: antes, uma falha por caminho ocupado apagaria o arquivo alheio
            registerRollbackCleanup(relativePath);

            AuthorizationRequestDocument document = new AuthorizationRequestDocument();
            document.setAuthorizationRequest(request);
            document.setOriginalFilename(baseNameOf(file.getOriginalFilename()) + "." + type.getExtension());
            document.setStoredPath(relativePath);
            document.setContentType(type.getContentType());
            document.setSizeBytes(file.getSize());
            document.setUploadedBy(user);

            return documentRepository.save(document);

        } catch (IOException e) {
            throw new StorageException("Não foi possível ler o arquivo enviado.", e);
        }
    }

    // O filesystem não participa da transação: se ela não commitar, o arquivo sai do disco
    private void registerRollbackCleanup(String relativePath) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) {
                    documentStorage.delete(relativePath);
                }
            }
        });
    }
}
