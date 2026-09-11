package com.joao_v_marques.portal_atendimento.authorization.authorization_request_document;

import com.joao_v_marques.portal_atendimento.authorization.authorization_request.AuthorizationRequest;
import com.joao_v_marques.portal_atendimento.users.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(name = "authorization_request_documents")
@Getter
@Setter
@NoArgsConstructor
public class AuthorizationRequestDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "original_filename", nullable = false)
    private String originalFilename;

    @Column(name = "stored_path", nullable = false, unique = true)
    private String storedPath;

    @Column(name = "content_type", nullable = false)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private Long sizeBytes;

    @Column(name = "uploaded_at", nullable = false)
    private OffsetDateTime uploadedAt = OffsetDateTime.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by", nullable = false)
    private User uploadedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "authorization_request_id", nullable = false)
    private AuthorizationRequest authorizationRequest;
}
