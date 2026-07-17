package com.metaplatform.iam.entity.mfa;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "iam_user_mfa")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserMfaEntity {

    public enum MfaType {
        TOTP,
        SMS,
        EMAIL
    }

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "user_id", nullable = false, length = 64)
    private String userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "mfa_type", nullable = false, length = 16)
    private MfaType mfaType;

    @Column(name = "secret", length = 256)
    private String secret;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled;

    @Column(name = "verified", nullable = false)
    private Boolean verified;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
