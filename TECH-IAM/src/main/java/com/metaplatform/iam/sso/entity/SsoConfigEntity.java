package com.metaplatform.iam.sso.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "iam_sso_config")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SsoConfigEntity {

    public enum ProviderType { OAUTH2, OIDC, SAML, LDAP, CUSTOM }

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "provider_name", nullable = false, length = 128)
    private String providerName;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Enumerated(EnumType.STRING)
    @Column(name = "provider_type", nullable = false, length = 16)
    private ProviderType providerType;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "client_id", length = 256)
    private String clientId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "client_secret_encrypted", length = 255)
    private String clientSecretEncrypted;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "redirect_uri", length = 512)
    private String redirectUri;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "scopes", length = 512)
    private String scopes;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "config", columnDefinition = "TEXT")
    private String config;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled;

    @Column(name = "version", nullable = false)
    private Integer version;

    @Column(name = "deleted", nullable = false)
    private Boolean deleted;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "created_by", length = 64)
    private String createdBy;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "updated_by", length = 64)
    private String updatedBy;

}
