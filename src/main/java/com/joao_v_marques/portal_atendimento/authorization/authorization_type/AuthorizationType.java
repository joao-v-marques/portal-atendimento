package com.joao_v_marques.portal_atendimento.authorization.authorization_type;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "authorization_type")
@Getter
@Setter
@NoArgsConstructor
public class AuthorizationType {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "code", nullable = false, unique = true, length = 8)
    private String code;

    @Column(name = "name", nullable = false, unique = true)
    private String name;

    // Prazo da ANS em dias úteis; 0 = atendimento imediato
    @Column(name = "max_days", nullable = false)
    private Integer maxDays;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;
}
