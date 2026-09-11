package com.joao_v_marques.portal_atendimento.storage;

import org.springframework.core.io.Resource;

import java.io.InputStream;

public interface DocumentStorage {

    void store(InputStream content, String relativePath);
    Resource load(String relativePath);
    void delete(String relativePath);
    boolean exists(String relativePath);
}
