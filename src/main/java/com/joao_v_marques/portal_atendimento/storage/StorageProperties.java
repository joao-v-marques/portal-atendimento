package com.joao_v_marques.portal_atendimento.storage;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.nio.file.Path;

@ConfigurationProperties(prefix = "app.storage")
@Validated
public record StorageProperties(

        @NotNull
        Path documentsRoot,

        @Positive
        int maxFilesPerRequest
) {
    public StorageProperties {
        documentsRoot = documentsRoot.toAbsolutePath().normalize();
    }
}
