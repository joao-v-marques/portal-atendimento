package com.joao_v_marques.portal_atendimento.authorization.authorization_request.dto;

import com.joao_v_marques.portal_atendimento.authorization.authorization_status.AuthorizationStatus;
import com.joao_v_marques.portal_atendimento.authorization.authorization_type.AuthorizationType;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record AuthorizationRequestRequest(
        @NotBlank(message = "Preencha o número da transação")
        @Size(min = 12, max = 12, message = "O número da transação deve conter exatamente 12 caracteres")
        String transactionNumber,

        @NotNull(message = "Preencha a data da requisição/autorização")
        @FutureOrPresent(message = "A data da requisição/autorização não pode ser retroativa")
        LocalDate requestDate,

        @NotNull(message = "Preencha o tipo da autorização")
        @Positive(message = "Tipo da autorização inválido")
        Integer authorizationTypeId,

        @NotNull(message = "Preencha o status da autorização")
        @Positive(message = "Status da autorização inválido")
        Integer authorizationStatusId,

        @NotBlank(message = "Preencha o nome do beneficiário")
        @Size(max = 255, message = "A quantidade máxima de caracteres para o nome do beneficiário é 255")
        String beneficiaryName,

        @NotBlank(message = "Preencha o número de telefone do beneficiário")
        @Size(max = 12, message = "A quantidade máxima de caracteres para o número de telefone do beneficiário é 12")
        String beneficiaryPhone
) {
}
