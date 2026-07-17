package com.metaplatform.iam.sso.entity;

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
@Table(name = "iam_sso_config")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class SsoConfigEntity extends AuditEntity {

    public enum ProviderType {
        OAUTH2,
        OIDC,
        SAML
    }

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "provider_name", nullable = false, length = 128)
    private String providerName;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider_type", nullable = false, length = 16)
    private ProviderType providerType;

    @Column(name = "client_id", length = 256)
    private String clientId;

    @Column(name = "client_secret_encrypted")
    private String clientSecretEncrypted;

    @Column(name = "redirect_uri", length = 512)
    private String redirectUri;

    @Column(name = "scopes", length = 512)
    private String scopes;

    @Column(name = "config", columnDefinition = "TEXT")
    private String config;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version;
}
