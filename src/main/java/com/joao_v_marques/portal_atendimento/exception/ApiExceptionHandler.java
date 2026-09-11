package com.joao_v_marques.portal_atendimento.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import org.springframework.validation.BindException;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(BindException.class)
    public ResponseEntity<ApiError> handleValidation(BindException ex) {
        Map<String, String> fields = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(error ->
                fields.putIfAbsent(error.getField(), messageOf(error)));

        return ResponseEntity.badRequest()
                .body(new ApiError("Revise os campos destacados.", fields));
    }

    // Exception padrão para erros em campos. Regras de negócio no geral.
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiError> handleBusinessExceptions(IllegalArgumentException ex) {
        return ResponseEntity.badRequest()
                .body(ApiError.of(ex.getMessage()));
    }

    // Exception de corpo ausente, JSON mal formatado ou tipo de campo incompatível
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleUnreadableBody(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest()
                .body(ApiError.of("Não foi possível ler o corpo da requisição. Envie um JSON válido."));
    }

    // Exception para erros de armazenamento
    @ExceptionHandler(StorageException.class)
    public ResponseEntity<ApiError> handleStorage(StorageException ex) {
        log.error("Falha no armazenamento de documento", ex);
        return ResponseEntity.internalServerError()
                .body(ApiError.of("Não foi possível processar o arquivo. Tente novamente."));
    }

    // Tratamento de erro para Violação de chave unique no banco
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> handleDataIntegrity(DataIntegrityViolationException ex) {
        log.warn("Violação de integridade: ", ex);
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiError.of("A operação conflita com um registro já existente. Verifique os dados e tente novamente."));
    }

    private String messageOf(FieldError error) {
        return error.isBindingFailure()
                ? "O valor informado não é válido para este campo."
                : error.getDefaultMessage();
    }
}
