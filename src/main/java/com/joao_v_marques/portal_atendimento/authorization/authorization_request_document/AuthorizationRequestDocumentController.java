package com.joao_v_marques.portal_atendimento.authorization.authorization_request_document;

import com.joao_v_marques.portal_atendimento.authorization.authorization_request_document.dto.AuthorizationRequestDocumentResponse;
import com.joao_v_marques.portal_atendimento.authorization.authorization_request_document.dto.DocumentDownload;
import com.joao_v_marques.portal_atendimento.security.UserPrincipal;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/authorization-requests/{requestId}/documents")
public class AuthorizationRequestDocumentController {

    private final AuthorizationRequestDocumentService authorizationRequestDocumentService;

    public AuthorizationRequestDocumentController(AuthorizationRequestDocumentService authorizationRequestDocumentService) {
        this.authorizationRequestDocumentService = authorizationRequestDocumentService;
    }

    // GET de todos os documentos com base na request
    @GetMapping
    public List<AuthorizationRequestDocumentResponse> findByRequest(@PathVariable Integer requestId) {
        return authorizationRequestDocumentService.findByRequest(requestId);
    }

    // GET do arquivo em si. attachment + filename* (RFC 5987) preserva acentos no nome baixado
    @GetMapping("/{documentId}/download")
    public ResponseEntity<Resource> download(@PathVariable Integer requestId, @PathVariable Integer documentId) {
        DocumentDownload download = authorizationRequestDocumentService.loadForDownload(requestId, documentId);

        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(download.filename(), StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(download.contentType()))
                .contentLength(download.sizeBytes())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(download.resource());
    }

    // POST avulso, para o documento que chega depois da autorização já criada
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AuthorizationRequestDocumentResponse> upload(
            @PathVariable Integer requestId,
            @RequestPart("file") MultipartFile file,
            @AuthenticationPrincipal UserPrincipal currentUser) {

        AuthorizationRequestDocumentResponse created =
                authorizationRequestDocumentService.upload(requestId, file, currentUser.getId());

        URI location = URI.create("/api/authorization-requests/" + requestId + "/documents/" + created.id());

        return ResponseEntity.created(location).body(created);
    }
}
