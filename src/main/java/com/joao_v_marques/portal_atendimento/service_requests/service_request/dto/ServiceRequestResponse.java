package com.joao_v_marques.portal_atendimento.service_requests.service_request.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;

// Id e nome de cada relação: o nome é para a listagem e o id para preencher os selects na edição
public record ServiceRequestResponse(
        Integer id,
        String protocolNumber,
        Integer categoryId,
        String categoryName,
        Integer channelId,
        String channelName,
        Integer typeId,
        String typeName,
        Integer severityId,
        String severityName,
        Integer statusId,
        String statusName,
        String requesterCardNumber,
        String requesterName,
        String requesterCpf,
        LocalDate requesterBirthDate,
        String requesterPhone,
        String requesterEmail,
        String description,
        String resolution,
        Integer assignedToId,
        String assignedToName,
        OffsetDateTime openedAt,
        OffsetDateTime closedAt,
        String insertedByName,
        String updatedByName,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
