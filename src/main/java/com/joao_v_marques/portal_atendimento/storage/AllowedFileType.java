package com.joao_v_marques.portal_atendimento.storage;

import java.util.Arrays;

public enum AllowedFileType {

    PDF("application/pdf", "pdf",
            new byte[]{0x25, 0x50, 0x44, 0x46, 0x2D}),
    JPEG("image/jpeg", "jpg",
            new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF}),
    PNG("image/png", "png",
            new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A});

    private final String contentType;
    private final String extension;
    private final byte[] signature;

    AllowedFileType(String contentType, String extension, byte[] signature) {
        this.contentType = contentType;
        this.extension = extension;
        this.signature = signature;
    }

    public String getContentType() {
        return contentType;
    }

    public String getExtension() {
        return extension;
    }

    boolean matches(byte[] header) {
        if (header.length < signature.length) {
            return false;
        }
        return Arrays.equals(header, 0, signature.length, signature, 0, signature.length);
    }

    static int longestSignature() {
        return Arrays.stream(values())
                .mapToInt(type -> type.signature.length)
                .max()
                .orElse(0);
    }
}
