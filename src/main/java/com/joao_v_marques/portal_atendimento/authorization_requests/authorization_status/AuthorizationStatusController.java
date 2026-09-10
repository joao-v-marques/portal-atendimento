package com.joao_v_marques.portal_atendimento.authorization_requests.authorization_status;

import com.joao_v_marques.portal_atendimento.authorization_requests.authorization_status.dto.AuthorizationStatusRequest;
import com.joao_v_marques.portal_atendimento.authorization_requests.authorization_status.dto.AuthorizationStatusResponse;
import jakarta.validation.Valid;
import org.apache.coyote.Response;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/authorization-status")
public class AuthorizationStatusController {

    private final AuthorizationStatusService authorizationStatusService;

    public AuthorizationStatusController(AuthorizationStatusService authorizationStatusService) {
        this.authorizationStatusService = authorizationStatusService;
    }

    // GET de todos os cadastrados no sistema
    @GetMapping
    public List<AuthorizationStatusResponse> findAll() {
        return authorizationStatusService.findAll();
    }

    // POST de um novo status de autorização
    @PostMapping
    public ResponseEntity<AuthorizationStatusResponse> create(@Valid @RequestBody AuthorizationStatusRequest request) {
        AuthorizationStatusResponse saved = authorizationStatusService.create(request);

        URI location = URI.create("/api/authorization-status/" + saved.id());

        return ResponseEntity.created(location).body(saved);
    }
}
