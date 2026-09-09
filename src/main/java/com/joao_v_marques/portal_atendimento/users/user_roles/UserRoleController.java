package com.joao_v_marques.portal_atendimento.users.user_roles;

import com.joao_v_marques.portal_atendimento.users.user_roles.dto.UserRoleIsActiveResponse;
import com.joao_v_marques.portal_atendimento.users.user_roles.dto.UserRoleRequest;
import com.joao_v_marques.portal_atendimento.users.user_roles.dto.UserRoleResponse;
import jakarta.validation.Valid;
import org.apache.coyote.Response;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.print.attribute.standard.Media;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/user-roles")
public class UserRoleController {

    private final UserRoleService userRoleService;

    public UserRoleController(UserRoleService userRoleService) {
        this.userRoleService = userRoleService;
    }

    // GET de todas as roles cadastradas no sistema
    @GetMapping
    public List<UserRoleResponse> findAll() {
        return userRoleService.findAll();
    }

    // POST de uma nova role no sistema
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<UserRoleResponse> create(@Valid @RequestBody UserRoleRequest request) {
        UserRoleResponse created = userRoleService.create(request);

        URI location = URI.create("api/user-roles/" + created.id());

        return ResponseEntity.created(location).body(created);
    }

    // PUT de uma role já existente
    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<UserRoleResponse> update(@PathVariable Integer id, @Valid @RequestBody UserRoleRequest request) {
        UserRoleResponse updated = userRoleService.update(id, request);

        return ResponseEntity.ok(updated);
    }

    // PATCH para desativar uma role já existente
    @PatchMapping(value = "/{id}/deactivate")
    public ResponseEntity<UserRoleIsActiveResponse> deactivate(@PathVariable Integer id) {
        UserRoleIsActiveResponse deactivated = userRoleService.deactivate(id);

        return ResponseEntity.ok(deactivated);
    }

    // PATCH para reativar uma role já existente
    @PatchMapping(value = "/{id}/reactivate")
    public ResponseEntity<UserRoleIsActiveResponse> reactivate(@PathVariable Integer id) {
        UserRoleIsActiveResponse reactivated = userRoleService.reactivate(id);

        return ResponseEntity.ok(reactivated);
    }
}
