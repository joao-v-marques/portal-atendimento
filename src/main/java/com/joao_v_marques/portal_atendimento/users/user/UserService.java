package com.joao_v_marques.portal_atendimento.users.user;

import com.joao_v_marques.portal_atendimento.exception.ConflictException;
import com.joao_v_marques.portal_atendimento.exception.ResourceNotFoundException;
import com.joao_v_marques.portal_atendimento.users.user.dto.UserIsActiveResponse;
import com.joao_v_marques.portal_atendimento.users.user.dto.UserPasswordRequest;
import com.joao_v_marques.portal_atendimento.users.user.dto.UserRequest;
import com.joao_v_marques.portal_atendimento.users.user.dto.UserResponse;
import com.joao_v_marques.portal_atendimento.users.user.dto.UserUpdateRequest;
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
    @Transactional(readOnly = true)
    public List<UserResponse> findAll() {
        return userRepository.findAllWithRole()
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
            throw new ConflictException("O usuário que tentou cadastrar já existe.");
        }

        UserRole role = userRolesRepository.findById(request.roleId())
                .orElseThrow(() -> new ResourceNotFoundException("Perfil de acesso não encontrado."));

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

    @Transactional
    public UserResponse update(Integer id, UserUpdateRequest request, Integer currentUserId) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado nenhum usuário com o ID passado."));

        if (!user.isActive()) {
            throw new ConflictException("Não é possível editar um usuário inativo.");
        }

        if (request.username() != null) {
            String username = request.username().trim();

            if (username.isEmpty()) {
                throw new IllegalArgumentException("Preencha o campo de usuário.");
            }

            // Só valida duplicidade se o username realmente mudou
            if (!username.equalsIgnoreCase(user.getUsername()) && userRepository.existsByUsernameIgnoreCase(username)) {
                throw new ConflictException("Já existe um usuário com esse nome de usuário.");
            }

            user.setUsername(username);
        }

        if (request.name() != null) {
            user.setName(StringUtils.hasText(request.name()) ? request.name().trim() : null);
        }

        if (request.email() != null) {
            user.setEmail(StringUtils.hasText(request.email()) ? request.email().trim() : null);
        }

        if (request.roleId() != null) {
            UserRole role = userRolesRepository.findById(request.roleId())
                    .orElseThrow(() -> new ResourceNotFoundException("Perfil de acesso não encontrado"));

            // Trocar o próprio perfil deixaria o portal sem administrador quando só existe um
            if (!role.getId().equals(user.getRole().getId()) && id.equals(currentUserId)) {
                throw new ConflictException("Você não pode alterar o seu próprio perfil de acesso.");
            }

            user.setRole(role);
        }

        return toResponse(user);
    }

    // PATCH da senha, feito por um administrador; não existe troca pelo próprio usuário
    @Transactional
    public void changePassword(Integer id, UserPasswordRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado usuário com o ID informado"));

        if (!user.isActive()) {
            throw new ConflictException("Não é possível redefinir a senha de um usuário inativo.");
        }

        user.setPasswordHash(passwordEncoder.encode(request.password()));
    }

    @Transactional
    public UserIsActiveResponse deactivate(Integer id, Integer currentUserId) {
        // Sem esta guarda, o único administrador consegue se trancar fora da administração
        if (id.equals(currentUserId)) {
            throw new ConflictException("Você não pode desativar o próprio usuário.");
        }

        // Validação se o usuário realmente existe
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado usuário com o ID informado"));

        if (!user.isActive()) {
            throw new ConflictException("O usuário já está inativo");
        }

        user.setActive(false);

        return toIsActiveResponse(user);
    }

    @Transactional
    public UserIsActiveResponse reactivate(Integer id) {
        // Validação se o usuário realmente existe
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Não foi encontrado usuário com o ID informado"));

        if (user.isActive()) {
            throw new ConflictException("Este usuário já está ativo");
        }

        user.setActive(true);

        return toIsActiveResponse(user);
    }

    private UserResponse toResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getName(),
                user.getEmail(),
                user.getRole(),
                user.getCreatedAt(),
                user.isActive()
        );
    }

    private UserIsActiveResponse toIsActiveResponse(User user) {
        return new UserIsActiveResponse(
                user.getUsername(),
                user.getName(),
                user.getEmail(),
                user.isActive()
        );
    }
}
