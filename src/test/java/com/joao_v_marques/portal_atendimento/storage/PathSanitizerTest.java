package com.joao_v_marques.portal_atendimento.storage;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PathSanitizerTest {

    @Test
    @DisplayName("preserva acentos e espaços, que é a decisão de produto")
    void preservaAcentosEEspacos() {
        assertEquals("João da Silva", PathSanitizer.sanitize("João da Silva"));
    }

    @Test
    @DisplayName("substitui barras para não quebrar a hierarquia de diretórios")
    void substituiBarras() {
        assertEquals("João_Maria", PathSanitizer.sanitize("João/Maria"));
        assertEquals("João_Maria", PathSanitizer.sanitize("João\\Maria"));
    }

    @Test
    @DisplayName("substitui os caracteres inválidos no Windows")
    void substituiCaracteresInvalidosDoWindows() {
        assertEquals("a_b_c_d", PathSanitizer.sanitize("a:b*c?d"));
    }

    @Test
    @DisplayName("neutraliza path traversal")
    void neutralizaPathTraversal() {
        assertThrows(IllegalArgumentException.class, () -> PathSanitizer.sanitize(".."));
        assertEquals(".._etc", PathSanitizer.sanitize("../etc"));
    }

    @Test
    @DisplayName("prefixa nomes reservados do Windows, com ou sem extensão")
    void prefixaNomesReservados() {
        assertEquals("_CON", PathSanitizer.sanitize("CON"));
        assertEquals("_CON.pdf", PathSanitizer.sanitize("CON.pdf"));
        assertEquals("_nul", PathSanitizer.sanitize("nul"));
    }

    @Test
    @DisplayName("remove ponto e espaço finais, que o Windows apagaria em silêncio")
    void removePontoEEspacoFinais() {
        assertEquals("laudo", PathSanitizer.sanitize("laudo."));
        assertEquals("laudo", PathSanitizer.sanitize("laudo   "));
    }

    @Test
    @DisplayName("trunca o segmento para não estourar o MAX_PATH do Windows")
    void truncaSegmentoLongo() {
        String longo = "a".repeat(200);
        assertEquals(80, PathSanitizer.sanitize(longo).length());
    }

    @Test
    @DisplayName("rejeita entrada vazia")
    void rejeitaEntradaVazia() {
        assertThrows(IllegalArgumentException.class, () -> PathSanitizer.sanitize(null));
        assertThrows(IllegalArgumentException.class, () -> PathSanitizer.sanitize("   "));
    }
}
