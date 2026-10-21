package com.joao_v_marques.portal_atendimento.service_requests.service_request;

import com.joao_v_marques.portal_atendimento.service_requests.category.ServiceRequestCategory;
import com.joao_v_marques.portal_atendimento.service_requests.channel.ServiceRequestChannel;
import com.joao_v_marques.portal_atendimento.service_requests.severity.ServiceRequestSeverity;
import com.joao_v_marques.portal_atendimento.service_requests.status.ServiceRequestStatus;
import com.joao_v_marques.portal_atendimento.service_requests.type.ServiceRequestType;
import com.joao_v_marques.portal_atendimento.users.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "service_requests")
@Getter
@Setter
@NoArgsConstructor
public class ServiceRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    // Informações do chamado
    @Column(name = "protocol_number", nullable = false, unique = true)
    private String protocolNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private ServiceRequestCategory category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "channel_id", nullable = false)
    private ServiceRequestChannel channel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "type_id", nullable = false)
    private ServiceRequestType type;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "severity_id")
    private ServiceRequestSeverity severity;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "status_id", nullable = false)
    private ServiceRequestStatus status;

    // Informações do solicitante
    @Column(name = "requester_card_number", nullable = false)
    private String requesterCardNumber;

    @Column(name = "requester_name", nullable = false)
    private String requesterName;

    // CHAR(11) no banco: sem o JdbcTypeCode o Hibernate espera VARCHAR e o ddl-auto validate derruba a aplicação
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "requester_cpf", length = 11)
    private String requesterCpf;

    @Column(name = "requester_birth_date")
    private LocalDate requesterBirthDate;

    @Column(name = "requester_phone")
    private String requesterPhone;

    @Column(name = "requester_email")
    private String requesterEmail;

    // Conteúdo
    @Column(name = "description", nullable = false)
    private String description;

    @Column(name = "resolution")
    private String resolution;

    // Responsável pelo chamado e prazos
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to", nullable = false)
    private User assignedTo;

    @Column(name = "opened_at", nullable = false)
    private OffsetDateTime openedAt = OffsetDateTime.now();

    @Column(name = "closed_at")
    private OffsetDateTime closedAt;

    // Auditoria
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inserted_by", nullable = false)
    private User insertedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by")
    private User updatedBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
