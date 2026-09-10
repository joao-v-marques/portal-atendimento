package com.joao_v_marques.portal_atendimento.authorization.authorization_request;

import com.joao_v_marques.portal_atendimento.authorization.authorization_request.dto.AuthorizationRequestResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
}
