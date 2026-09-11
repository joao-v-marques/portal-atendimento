package com.joao_v_marques.portal_atendimento.storage;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.BufferedInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FileTypeValidatorTest {

    private final FileTypeValidator validator = new FileTypeValidator();

    private static final byte[] PDF_HEADER = {0x25, 0x50, 0x44, 0x46, 0x2D};
    private static final byte[] JPEG_HEADER = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] PNG_HEADER = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
    private static final byte[] EXE_HEADER = {0x4D, 0x5A, (byte) 0x90, 0x00};

    private InputStream streamOf(byte[] header, int padding) {
        byte[] content = new byte[header.length + padding];
        System.arraycopy(header, 0, content, 0, header.length);
        return new BufferedInputStream(new ByteArrayInputStream(content));
    }

    @Test
    @DisplayName("detecta PDF pelos bytes iniciais")
    void detectaPdf() {
        assertEquals(Optional.of(AllowedFileType.PDF), validator.detect(streamOf(PDF_HEADER, 64)));
    }

    @Test
    @DisplayName("detecta JPEG pelos bytes iniciais")
    void detectaJpeg() {
        assertEquals(Optional.of(AllowedFileType.JPEG), validator.detect(streamOf(JPEG_HEADER, 64)));
    }

    @Test
    @DisplayName("detecta PNG pelos bytes iniciais")
    void detectaPng() {
        assertEquals(Optional.of(AllowedFileType.PNG), validator.detect(streamOf(PNG_HEADER, 64)));
    }

    @Test
    @DisplayName("rejeita executável renomeado para .pdf: o nome não vale, os bytes valem")
    void rejeitaExecutavelDisfarcado() {
        assertTrue(validator.detect(streamOf(EXE_HEADER, 64)).isEmpty());
    }

    @Test
    @DisplayName("rejeita arquivo vazio e arquivo menor que a assinatura, sem estourar índice")
    void rejeitaArquivoCurtoDemais() {
        assertTrue(validator.detect(streamOf(new byte[0], 0)).isEmpty());
        assertTrue(validator.detect(streamOf(new byte[]{0x25, 0x50}, 0)).isEmpty());
    }

    @Test
    @DisplayName("devolve o stream intacto: o Files.copy precisa receber o arquivo completo")
    void naoConsomeOStream() throws IOException {
        byte[] original = new byte[PDF_HEADER.length + 32];
        System.arraycopy(PDF_HEADER, 0, original, 0, PDF_HEADER.length);
        for (int i = PDF_HEADER.length; i < original.length; i++) {
            original[i] = (byte) i;
        }

        InputStream content = new BufferedInputStream(new ByteArrayInputStream(original));

        assertEquals(Optional.of(AllowedFileType.PDF), validator.detect(content));
        assertArrayEquals(original, content.readAllBytes());
    }
}
