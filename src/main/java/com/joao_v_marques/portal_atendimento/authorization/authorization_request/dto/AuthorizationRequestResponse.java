package com.joao_v_marques.portal_atendimento.authorization.authorization_request.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record AuthorizationRequestResponse(
        Integer id,
        String transactionNumber,
        LocalDate requestDate,
        LocalDate finishDate,
        String authorizationTypeName,
        String authorizationStatusName,
        String beneficiaryName,
        String beneficiaryPhone,
        OffsetDateTime createdAt,
        String insertedByName
) {
}
