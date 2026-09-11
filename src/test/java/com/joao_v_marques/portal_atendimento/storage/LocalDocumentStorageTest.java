package com.joao_v_marques.portal_atendimento.storage;

import com.joao_v_marques.portal_atendimento.exception.StorageException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LocalDocumentStorageTest {

    @TempDir
    Path tempDir;

    private LocalDocumentStorage storage;

    private static final String PATH = "A1B2C3D4E5F6/laudo.pdf";
    private static final byte[] CONTENT = "conteudo do laudo".getBytes(StandardCharsets.UTF_8);

    @BeforeEach
    void setUp() {
        storage = new LocalDocumentStorage(new StorageProperties(tempDir, 10));
    }

    private InputStream content() {
        return new ByteArrayInputStream(CONTENT);
    }

    @Test
    @DisplayName("grava e lê de volta o mesmo conteúdo")
    void gravaELe() throws IOException {
        storage.store(content(), PATH);

        assertTrue(storage.exists(PATH));
        assertArrayEquals(CONTENT, storage.load(PATH).getInputStream().readAllBytes());
    }

    @Test
    @DisplayName("cria a árvore de diretórios da autorização")
    void criaDiretoriosPai() {
        storage.store(content(), PATH);

        assertTrue(Files.isDirectory(tempDir.resolve("A1B2C3D4E5F6")));
    }

    @Test
    @DisplayName("não sobrescreve arquivo existente: é a última defesa contra colisão")
    void naoSobrescreve() {
        storage.store(content(), PATH);

        assertThrows(StorageException.class, () -> storage.store(content(), PATH));
        assertArrayEquals(CONTENT, assertDoesNotThrow(() -> storage.load(PATH).getInputStream().readAllBytes()));
    }

    @Test
    @DisplayName("bloqueia path traversal em todos os quatro métodos")
    void bloqueiaPathTraversal() {
        String escape = "../fora.pdf";

        assertThrows(StorageException.class, () -> storage.store(content(), escape));
        assertThrows(StorageException.class, () -> storage.load(escape));
        assertThrows(StorageException.class, () -> storage.delete(escape));
        assertThrows(StorageException.class, () -> storage.exists(escape));
    }

    @Test
    @DisplayName("bloqueia caminho absoluto, que o Path.resolve aceitaria descartando a raiz")
    void bloqueiaCaminhoAbsoluto() {
        String absoluto = tempDir.getParent().resolve("fora.pdf").toString();

        assertThrows(StorageException.class, () -> storage.store(content(), absoluto));
    }

    @Test
    @DisplayName("delete é idempotente: apagar o que não existe é sucesso")
    void deleteIdempotente() {
        assertDoesNotThrow(() -> storage.delete(PATH));

        storage.store(content(), PATH);
        storage.delete(PATH);

        assertFalse(storage.exists(PATH));
        assertDoesNotThrow(() -> storage.delete(PATH));
    }

    @Test
    @DisplayName("load de arquivo inexistente falha antes de virar resposta HTTP")
    void loadInexistente() {
        assertThrows(StorageException.class, () -> storage.load(PATH));
    }
}
