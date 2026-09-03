package com.joao_v_marques.portal_atendimento.users.user;

import com.joao_v_marques.portal_atendimento.users.user.dto.UserResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    // GET de todos os usuários cadastrados na aplicação
    @Transactional
    public List<UserResponse> findAll() {
        return userRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private UserResponse toResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getName(),
                user.getPasswordHash(),
                user.getEmail(),
                user.getRoleId(),
                user.getCreatedAt(),
                user.is_active()
        );
    }
}
