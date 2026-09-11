package com.joao_v_marques.portal_atendimento.storage;

import com.joao_v_marques.portal_atendimento.exception.StorageException;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.FileAlreadyExistsException;
import java.nio.file.Files;
import java.nio.file.Path;

@Component
public class LocalDocumentStorage implements DocumentStorage {

    private final Path root;

    public LocalDocumentStorage(StorageProperties properties) {
        this.root = properties.documentsRoot();
        try {
            Files.createDirectories(root);
        } catch (IOException e) {
            throw new StorageException("Não foi possível criar o diretório de armazenamento.", e);
        }
    }

    private Path resolve(String relativePath) {
        Path target = root.resolve(relativePath).normalize();
        if (!target.startsWith(root)) {
            throw new StorageException("Caminho de armazenamento inválido");
        }
        return target;
    }

    @Override
    public void store(InputStream content, String relativePath) {
        Path target = resolve(relativePath);
        try {
            Files.createDirectories(target.getParent());
            Files.copy(content, target);
        } catch (FileAlreadyExistsException e) {
            throw new StorageException("Já existe um arquivo em " + relativePath, e);
        } catch (IOException e) {
            throw new StorageException("Não foi possível gravar o arquivo.", e);
        }
    }

    @Override
    public Resource load(String relativePath) {
        Path target = resolve(relativePath);
        if (!Files.isReadable(target)) {
            throw new StorageException("Arquivo não encontrado no armazenamento: " + relativePath);
        }
        return new FileSystemResource(target);
    }

    @Override
    public void delete(String relativePath) {
        Path target = resolve(relativePath);
        try {
            Files.deleteIfExists(target);
        } catch (IOException e) {
            throw new StorageException("Não foi possível remover o arquivo.", e);
        }
    }

    @Override
    public boolean exists(String relativePath) {
        return Files.exists(resolve(relativePath));
    }
}
