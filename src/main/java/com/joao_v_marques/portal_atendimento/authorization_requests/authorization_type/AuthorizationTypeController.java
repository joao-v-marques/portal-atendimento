package com.joao_v_marques.portal_atendimento.authorization_requests.authorization_type;

import com.joao_v_marques.portal_atendimento.authorization_requests.authorization_type.dto.AuthorizationTypeResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/authorization-types")
public class AuthorizationTypeController {

    private final AuthorizationTypeService authorizationTypeService;

    public AuthorizationTypeController(AuthorizationTypeService authorizationTypeService) {
        this.authorizationTypeService = authorizationTypeService;
    }

    // GET de todos os tipos de autorização cadastrados no sistema
    @GetMapping
    public List<AuthorizationTypeResponse> findAll() {
        return authorizationTypeService.findAll();
    }
}
