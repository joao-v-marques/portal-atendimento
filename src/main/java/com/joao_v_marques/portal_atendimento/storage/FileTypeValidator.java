package com.joao_v_marques.portal_atendimento.storage;

import com.joao_v_marques.portal_atendimento.exception.StorageException;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.Optional;

@Component
public class FileTypeValidator {

    private static final int HEADER_SIZE = AllowedFileType.longestSignature();

    public Optional<AllowedFileType> detect(InputStream content) {
        if (!content.markSupported()) {
            throw new StorageException("O stream informado não suporta mark/reset.");
        }

        try {
            content.mark(HEADER_SIZE);
            byte[] header = content.readNBytes(HEADER_SIZE);
            content.reset();

            return Arrays.stream(AllowedFileType.values())
                    .filter(type -> type.matches(header))
                    .findFirst();
        } catch (IOException e) {
            throw new StorageException("Não foi possível ler o arquivo enviado.", e);
        }
    }
}
