package com.joao_v_marques.portal_atendimento.authorization.authorization_request;

import com.joao_v_marques.portal_atendimento.authorization.authorization_request.dto.AuthorizationRequestRequest;
import com.joao_v_marques.portal_atendimento.authorization.authorization_request.dto.AuthorizationRequestResponse;
import com.joao_v_marques.portal_atendimento.security.UserPrincipal;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/authorization-requests")
public class AuthorizationRequestController {

    private static final Logger log = LoggerFactory.getLogger(AuthorizationRequestController.class);

    private final AuthorizationRequestService authorizationRequestService;

    public AuthorizationRequestController(AuthorizationRequestService authorizationRequestService) {
        this.authorizationRequestService = authorizationRequestService;
        // TODO diagnóstico temporário - remover
        log.info("[upload-debug] build COM diagnóstico carregado");
    }

    @GetMapping
    public List<AuthorizationRequestResponse> findAll() {
        return authorizationRequestService.findAll();
    }

    // Criação sem documentos. Mantido para não quebrar clientes que já mandam JSON puro.
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<AuthorizationRequestResponse> create(@Valid @RequestBody AuthorizationRequestRequest request, @AuthenticationPrincipal UserPrincipal currentUser) {
        return created(authorizationRequestService.create(request, List.of(), currentUser.getId()));
    }

    // Criação atômica: autorização e documentos na mesma transação.
    // A parte "request" precisa declarar Content-Type: application/json.
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AuthorizationRequestResponse> createWithDocuments(
            @Valid @RequestPart("request") AuthorizationRequestRequest request,
            @RequestPart(value = "files", required = false) List<MultipartFile> files,
            @AuthenticationPrincipal UserPrincipal currentUser,
            HttpServletRequest httpRequest) throws ServletException, IOException {

        // TODO diagnóstico temporário - remover
        log.info("[upload-debug] partes recebidas: {}", httpRequest.getParts().stream()
                .map(p -> p.getName() + " [" + p.getSize() + " bytes, " + p.getContentType() + "]")
                .toList());
        log.info("[upload-debug] files vinculado: {}", files == null ? "null" : files.size() + " arquivo(s)");

        return created(authorizationRequestService.create(request, files, currentUser.getId()));
    }

    private ResponseEntity<AuthorizationRequestResponse> created(AuthorizationRequestResponse created) {
        URI location = URI.create("/api/authorization-requests/" + created.id());

        return ResponseEntity.created(location).body(created);
    }
}
