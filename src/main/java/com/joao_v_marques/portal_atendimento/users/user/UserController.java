package com.joao_v_marques.portal_atendimento.users.user;

import com.joao_v_marques.portal_atendimento.users.user.dto.UserIsActiveResponse;
import com.joao_v_marques.portal_atendimento.users.user.dto.UserRequest;
import com.joao_v_marques.portal_atendimento.users.user.dto.UserResponse;
import com.joao_v_marques.portal_atendimento.users.user.dto.UserUpdateRequest;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    // GET de todos os usuários cadastrados no sistema
    @GetMapping
    public List<UserResponse> findAll() {
        return userService.findAll();
    }

    // POST de um novo usuário
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<UserResponse> create(@Valid @RequestBody UserRequest request) {
        UserResponse created = userService.create(request);

        URI location = URI.create("/api/users/" + created.id());

        return ResponseEntity.created(location).body(created);
    }

    // PUT de um usuário
    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<UserResponse> update(@PathVariable Integer id, @Valid @RequestBody UserUpdateRequest request) {
        UserResponse updated = userService.update(id, request);

        return ResponseEntity.ok(updated);
    }

    // PATCH desativar usuário
    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<UserIsActiveResponse> deactivate(@PathVariable Integer id) {
        UserIsActiveResponse deactivatedUser = userService.deactivate(id);

        return ResponseEntity.ok(deactivatedUser);
    }

    // PATCH reativar um usuário
    @PatchMapping("/{id}/reactivate")
    public ResponseEntity<UserIsActiveResponse> reactivate(@PathVariable Integer id) {
        UserIsActiveResponse reactivatedUser = userService.reactivate(id);

        return ResponseEntity.ok(reactivatedUser);
    }
}
