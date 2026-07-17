package com.metaplatform.iam.mfa.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "iam_mfa_config")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MfaConfigEntity {

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

    @Column(name = "secret_encrypted")
    private String secretEncrypted;

    @Column(name = "phone", length = 32)
    private String phone;

    @Column(name = "email", length = 128)
    private String email;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled;

    @Column(name = "backup_codes", columnDefinition = "TEXT")
    private String backupCodes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
