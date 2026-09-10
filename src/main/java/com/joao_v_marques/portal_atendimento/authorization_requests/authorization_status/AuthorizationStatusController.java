package com.joao_v_marques.portal_atendimento.authorization_requests.authorization_status;

import com.joao_v_marques.portal_atendimento.authorization_requests.authorization_status.dto.AuthorizationStatusResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
}
