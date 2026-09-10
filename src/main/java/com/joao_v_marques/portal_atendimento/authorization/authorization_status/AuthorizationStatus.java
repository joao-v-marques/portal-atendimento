package com.joao_v_marques.portal_atendimento.authorization.authorization_status;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "authorization_status")
@Getter
@Setter
@NoArgsConstructor
public class AuthorizationStatus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "name", nullable = false, unique = true)
    private String name;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;
}
