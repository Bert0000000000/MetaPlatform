package com.metaplatform.iam.mfa.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "iam_mfa_config")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MfaConfigEntity {

    public enum MfaType { TOTP, SMS, EMAIL, BACKUP_CODE, FIDO2 }

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "user_id", nullable = false, length = 64)
    private String userId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Enumerated(EnumType.STRING)
    @Column(name = "mfa_type", nullable = false, length = 16)
    private MfaType mfaType;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "secret_encrypted", length = 255)
    private String secretEncrypted;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "phone", length = 32)
    private String phone;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "email", length = 128)
    private String email;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "backup_codes", columnDefinition = "TEXT")
    private String backupCodes;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

}
