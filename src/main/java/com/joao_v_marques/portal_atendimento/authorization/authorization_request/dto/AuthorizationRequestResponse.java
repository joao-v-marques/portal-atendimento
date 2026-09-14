package com.joao_v_marques.portal_atendimento.authorization.authorization_request.dto;

import com.joao_v_marques.portal_atendimento.authorization.authorization_status.AuthorizationStatus;
import com.joao_v_marques.portal_atendimento.authorization.authorization_type.AuthorizationType;
import com.joao_v_marques.portal_atendimento.users.user.User;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record AuthorizationRequestResponse(
        Integer id,
        String transactionNumber,
        LocalDate requestDate,
        String authorizationTypeName,
        String authorizationStatusName,
        String beneficiaryName,
        String beneficiaryPhone,
        OffsetDateTime createdAt,
        String insertedByName
) {
}
