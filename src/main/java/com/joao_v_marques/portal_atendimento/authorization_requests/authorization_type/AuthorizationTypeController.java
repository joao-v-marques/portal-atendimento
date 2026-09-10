package com.joao_v_marques.portal_atendimento.authorization_requests.authorization_type;

import com.joao_v_marques.portal_atendimento.authorization_requests.authorization_type.dto.AuthorizationTypeRequest;
import com.joao_v_marques.portal_atendimento.authorization_requests.authorization_type.dto.AuthorizationTypeResponse;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
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

    // POST de um novo tipo de autorização
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<AuthorizationTypeResponse> create(@Valid @RequestBody AuthorizationTypeRequest request) {
        AuthorizationTypeResponse saved = authorizationTypeService.create(request);

        URI location = URI.create("/api/authorization-types/" + saved.id());

        return ResponseEntity.created(location).body(saved);
    }

    // PUT para editar um tipo de autorização
    @PutMapping("/{id}")
    public ResponseEntity<AuthorizationTypeResponse> update(@PathVariable Integer id, @Valid @RequestBody AuthorizationTypeRequest request) {
        AuthorizationTypeResponse updated = authorizationTypeService.update(id, request);

        return ResponseEntity.ok(updated);
    }

    // PATCH para desativar um tipo de autorização
    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<AuthorizationTypeResponse> deactivate(@PathVariable Integer id) {
        AuthorizationTypeResponse deactivated = authorizationTypeService.deactivate(id);

        return ResponseEntity.ok(deactivated);
    }
}
