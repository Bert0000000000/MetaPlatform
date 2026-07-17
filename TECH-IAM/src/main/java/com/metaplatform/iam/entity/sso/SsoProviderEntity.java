package com.metaplatform.iam.entity.sso;

import com.metaplatform.iam.entity.AuditEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "iam_sso_provider")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class SsoProviderEntity extends AuditEntity {

    public enum ProviderType {
        OAUTH2,
        OIDC,
        SAML
    }

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider_type", nullable = false, length = 16)
    private ProviderType providerType;

    @Column(name = "name", nullable = false, length = 128)
    private String name;

    @Column(name = "client_id", length = 256)
    private String clientId;

    @Column(name = "client_secret", length = 512)
    private String clientSecret;

    @Column(name = "issuer_url", length = 512)
    private String issuerUrl;

    @Column(name = "authorization_endpoint", length = 512)
    private String authorizationEndpoint;

    @Column(name = "token_endpoint", length = 512)
    private String tokenEndpoint;

    @Column(name = "user_info_endpoint", length = 512)
    private String userInfoEndpoint;

    @Column(name = "scopes", length = 512)
    private String scopes;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled;

    @Column(name = "config", columnDefinition = "jsonb")
    private String config;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version;
}
