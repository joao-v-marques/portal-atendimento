package com.joao_v_marques.portal_atendimento.users.user;

import com.joao_v_marques.portal_atendimento.users.user.dto.UserRequest;
import com.joao_v_marques.portal_atendimento.users.user.dto.UserResponse;
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
}
