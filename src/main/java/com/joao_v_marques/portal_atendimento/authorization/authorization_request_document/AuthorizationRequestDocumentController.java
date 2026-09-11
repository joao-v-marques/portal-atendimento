package com.joao_v_marques.portal_atendimento.authorization.authorization_request_document;

import com.joao_v_marques.portal_atendimento.authorization.authorization_request_document.dto.AuthorizationRequestDocumentResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/authorization-request-documents")
public class AuthorizationRequestDocumentController {

    private final AuthorizationRequestDocumentService authorizationRequestDocumentServiceService;

    public AuthorizationRequestDocumentController(AuthorizationRequestDocumentService authorizationRequestDocumentService) {
        this.authorizationRequestDocumentServiceService = authorizationRequestDocumentService;
    }

    // GET de todos os documentos com base na request
    @GetMapping("/{id}")
    public List<AuthorizationRequestDocumentResponse> findByRequest(@PathVariable Integer id) {
        return authorizationRequestDocumentServiceService.findByRequest(id);
    }
}
