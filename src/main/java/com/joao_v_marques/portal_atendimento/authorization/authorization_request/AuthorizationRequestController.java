package com.joao_v_marques.portal_atendimento.authorization.authorization_request;

import com.joao_v_marques.portal_atendimento.authorization.authorization_request.dto.AuthorizationRequestRequest;
import com.joao_v_marques.portal_atendimento.authorization.authorization_request.dto.AuthorizationRequestResponse;
import com.joao_v_marques.portal_atendimento.security.UserPrincipal;
import jakarta.validation.Valid;
import org.apache.tomcat.util.http.parser.Authorization;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/authorization-requests")
public class AuthorizationRequestController {

    private final AuthorizationRequestService authorizationRequestService;

    public AuthorizationRequestController(AuthorizationRequestService authorizationRequestService) {
        this.authorizationRequestService = authorizationRequestService;
    }

    @GetMapping
    public List<AuthorizationRequestResponse> findAll() {
        return authorizationRequestService.findAll();
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<AuthorizationRequestResponse> create(@Valid @RequestBody AuthorizationRequestRequest request, @AuthenticationPrincipal UserPrincipal currentUser) {
        Integer currentUserId = currentUser.getId();

        AuthorizationRequestResponse created = authorizationRequestService.create(request, currentUserId);

        URI location = URI.create("/api/authorization-requests/" + created.id());

        return ResponseEntity.created(location).body(created);
    }
}
