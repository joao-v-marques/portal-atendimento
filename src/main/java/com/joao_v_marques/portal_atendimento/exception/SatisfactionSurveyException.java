package com.joao_v_marques.portal_atendimento.exception;

public class SatisfactionSurveyException extends RuntimeException {

    public SatisfactionSurveyException(String message) {
        super(message);
    }

    public SatisfactionSurveyException(String message, Throwable cause) {
        super(message, cause);
    }
}
