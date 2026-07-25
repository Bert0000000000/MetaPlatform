package com.metaplatform.iam.entity.sso;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;
import java.time.Instant;

@Entity
@Table(name = "iam_sso_provider")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SsoProviderEntity {

    public enum ProviderType { OAUTH2, OIDC, SAML, LDAP, CUSTOM }

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "created_by", length = 64)
    private String createdBy;

    @Column(name = "deleted", nullable = false)
    private Boolean deleted;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "updated_by", length = 64)
    private String updatedBy;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "authorization_endpoint", length = 512)
    private String authorizationEndpoint;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "client_id", length = 256)
    private String clientId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "client_secret", length = 512)
    private String clientSecret;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "config", columnDefinition = "jsonb")
    private Map<String, Object> config;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "issuer_url", length = 512)
    private String issuerUrl;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "name", nullable = false, length = 128)
    private String name;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Enumerated(EnumType.STRING)
    @Column(name = "provider_type", nullable = false, length = 16)
    private ProviderType providerType;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "scopes", length = 512)
    private String scopes;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "token_endpoint", length = 512)
    private String tokenEndpoint;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "user_info_endpoint", length = 512)
    private String userInfoEndpoint;

    @Column(name = "version", nullable = false)
    private Integer version;

}
