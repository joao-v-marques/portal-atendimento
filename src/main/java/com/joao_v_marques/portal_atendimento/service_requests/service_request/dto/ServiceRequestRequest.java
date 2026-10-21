package com.joao_v_marques.portal_atendimento.service_requests.service_request.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record ServiceRequestRequest(

        // Informações do chamado
        @NotBlank(message = "Preencha o número do protocolo")
        @Size(max = 20, message = "O número do protocolo deve ter no máximo 20 caracteres")
        String protocolNumber,

        @NotNull(message = "Preencha a categoria do atendimento")
        @Positive(message = "Categoria do atendimento inválida")
        Integer categoryId,

        @NotNull(message = "Preencha o canal do atendimento")
        @Positive(message = "Canal do atendimento inválido")
        Integer channelId,

        @NotNull(message = "Preencha o tipo do atendimento")
        @Positive(message = "Tipo do atendimento inválido")
        Integer typeId,

        // Opcional: o chamado pode ser aberto sem severidade
        @Positive(message = "Severidade inválida")
        Integer severityId,

        @NotNull(message = "Preencha o status do atendimento")
        @Positive(message = "Status do atendimento inválido")
        Integer statusId,

        // Informações do solicitante
        @NotBlank(message = "Preencha o número da carteirinha do solicitante")
        @Size(max = 17, message = "O número da carteirinha deve ter no máximo 17 dígitos")
        @Pattern(regexp = "\\d*", message = "O número da carteirinha deve conter apenas números")
        String requesterCardNumber,

        @NotBlank(message = "Preencha o nome do solicitante")
        @Size(max = 150, message = "O nome do solicitante deve ter no máximo 150 caracteres")
        String requesterName,

        // Opcional: em branco é aceito aqui e vira null no service
        @Pattern(regexp = "\\s*|\\d{11}", message = "O CPF deve conter exatamente 11 números")
        String requesterCpf,

        @Past(message = "A data de nascimento deve ser uma data passada")
        LocalDate requesterBirthDate,

        @Size(max = 20, message = "O telefone do solicitante deve ter no máximo 20 caracteres")
        String requesterPhone,

        @Email(message = "Informe um e-mail válido")
        @Size(max = 150, message = "O e-mail do solicitante deve ter no máximo 150 caracteres")
        String requesterEmail,

        // Conteúdo
        @NotBlank(message = "Preencha a descrição do atendimento")
        String description,

        // Responsável e prazos
        @NotNull(message = "Preencha o responsável pelo atendimento")
        @Positive(message = "Responsável pelo atendimento inválido")
        Integer assignedToId,

        // Opcional: permite registrar um atendimento que já aconteceu. Se vier nulo, vale o momento atual
        @PastOrPresent(message = "A data de abertura não pode ser futura")
        OffsetDateTime openedAt
) {
}
