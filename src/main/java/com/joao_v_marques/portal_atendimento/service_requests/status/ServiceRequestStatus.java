package com.joao_v_marques.portal_atendimento.service_requests.status;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "service_request_status")
@Getter
@Setter
@NoArgsConstructor
public class ServiceRequestStatus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "name", nullable = false, unique = true)
    private String name;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;
}
