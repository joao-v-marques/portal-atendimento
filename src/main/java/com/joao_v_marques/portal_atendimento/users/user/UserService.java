package com.joao_v_marques.portal_atendimento.users.user;

import com.joao_v_marques.portal_atendimento.users.user.dto.UserRequest;
import com.joao_v_marques.portal_atendimento.users.user.dto.UserResponse;
import com.joao_v_marques.portal_atendimento.users.user_roles.UserRole;
import com.joao_v_marques.portal_atendimento.users.user_roles.UserRolesRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final UserRolesRepository userRolesRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, UserRolesRepository userRolesRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.userRolesRepository = userRolesRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // GET de todos os usuários cadastrados na aplicação
    @Transactional
    public List<UserResponse> findAll() {
        return userRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // POST de um usuário
    @Transactional
    public UserResponse create(UserRequest request) {
        String username = request.username().trim();
        String name = StringUtils.hasText(request.name()) ? request.name().trim() : null;
        String email = StringUtils.hasText(request.email()) ? request.email().trim() : null;

        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw new IllegalArgumentException("O usuário que tentou cadastrar já existe.");
        }

        UserRole role = userRolesRepository.findById(request.roleId())
                .orElseThrow(() -> new IllegalArgumentException("Perfil de acesso não encontrado."));

        // Montar a entidade com base no dto
        User user = new User();
        user.setUsername(username);
        user.setName(name);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setEmail(email);
        user.setRole(role);

        User saved = userRepository.save(user);

        return toResponse(saved);
    }

    private UserResponse toResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getName(),
                user.getPasswordHash(),
                user.getEmail(),
                user.getRole(),
                user.getCreatedAt(),
                user.isActive()
        );
    }
}
