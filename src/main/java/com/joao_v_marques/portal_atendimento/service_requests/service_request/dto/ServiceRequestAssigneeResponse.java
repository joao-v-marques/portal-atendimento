package com.joao_v_marques.portal_atendimento.service_requests.service_request.dto;

// Usuário que pode ser responsável por um chamado. O username permite ao front achar o usuário logado
public record ServiceRequestAssigneeResponse(
        Integer id,
        String name,
        String username
) {
}
