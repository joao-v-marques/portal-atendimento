package com.joao_v_marques.portal_atendimento.authorization.authorization_request;

import com.joao_v_marques.portal_atendimento.authorization.authorization_status.AuthorizationStatus;
import com.joao_v_marques.portal_atendimento.authorization.authorization_type.AuthorizationType;
import com.joao_v_marques.portal_atendimento.users.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "authorization_requests")
@Getter
@Setter
@NoArgsConstructor
public class AuthorizationRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "transaction_number", nullable = false)
    private String transactionNumber;

    @Column(name = "request_date", nullable = false)
    private LocalDate requestDate = LocalDate.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "authorization_type_id", nullable = false)
    private AuthorizationType authorizationType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "authorization_status_id", nullable = false)
    private AuthorizationStatus authorizationStatus;

    @Column(name = "beneficiary_name", nullable = false)
    private String beneficiaryName;

    @Column(name = "beneficiary_phone", nullable = false)
    private String beneficiaryPhone;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inserted_by", nullable = false)
    private User insertedBy;
}
