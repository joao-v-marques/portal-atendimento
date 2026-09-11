package com.joao_v_marques.portal_atendimento.authorization.authorization_request_document.dto;

import java.time.OffsetDateTime;

public record AuthorizationRequestDocumentResponse(
        Integer id,
        String originalFilename,
        String contentType,
        Long sizeBytes,
        OffsetDateTime uploadedAt,
        Integer uploadedById,
        String uploadedByName
) {
}
