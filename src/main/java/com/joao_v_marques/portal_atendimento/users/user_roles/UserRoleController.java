package com.joao_v_marques.portal_atendimento.users.user_roles;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
}
