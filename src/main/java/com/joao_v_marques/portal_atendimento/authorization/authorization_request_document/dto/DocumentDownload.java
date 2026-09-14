package com.joao_v_marques.portal_atendimento.authorization.authorization_request_document.dto;

import org.springframework.core.io.Resource;

public record DocumentDownload(
        Resource resource,
        String filename,
        String contentType,
        long sizeBytes
) {
}
