package com.joao_v_marques.portal_atendimento.authorization.authorization_request_document;

import com.joao_v_marques.portal_atendimento.authorization.authorization_request_document.dto.AuthorizationRequestDocumentResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
}
