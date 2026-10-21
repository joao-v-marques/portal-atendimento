package com.joao_v_marques.portal_atendimento.service_requests.severity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "service_request_severities")
@Getter
@Setter
@NoArgsConstructor
public class ServiceRequestSeverity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "name", nullable = false, unique = true)
    private String name;

    @Column(name = "level", nullable = false, unique = true)
    private Short level;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;
}
