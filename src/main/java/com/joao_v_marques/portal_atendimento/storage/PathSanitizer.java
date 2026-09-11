package com.joao_v_marques.portal_atendimento.storage;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Transforma texto livre em um segmento de caminho seguro para o filesystem.
 *
 * Acentos e espacos sao preservados de proposito: a arvore de diretorios precisa
 * continuar legivel por uma pessoa. O que sai sao barras, caracteres invalidos no
 * Windows e tudo que permitiria escapar da pasta de uploads.
 */
public final class PathSanitizer {

    private static final Pattern INVALID_CHARS = Pattern.compile("[\\\\/:*?\"<>|\\p{Cntrl}]");
    private static final Pattern TRAILING_JUNK = Pattern.compile("[.\\s]+$");

    private static final Set<String> RESERVED_NAMES = Set.of(
            "CON", "PRN", "AUX", "NUL",
            "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
            "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9");

    private static final int MAX_SEGMENT_LENGTH = 80;

    private PathSanitizer() {
    }

    public static String sanitize(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Nome inválido para armazenamento.");
        }

        String cleaned = INVALID_CHARS.matcher(value).replaceAll("_").trim();
        cleaned = TRAILING_JUNK.matcher(cleaned).replaceAll("");

        if (cleaned.length() > MAX_SEGMENT_LENGTH) {
            cleaned = cleaned.substring(0, MAX_SEGMENT_LENGTH).trim();
        }

        if (cleaned.isEmpty()) {
            throw new IllegalArgumentException("Nome inválido para armazenamento.");
        }

        String withoutExtension = cleaned.split("\\.")[0].toUpperCase(Locale.ROOT);
        if (RESERVED_NAMES.contains(withoutExtension)) {
            cleaned = "_" + cleaned;
        }

        return cleaned;
    }
}
