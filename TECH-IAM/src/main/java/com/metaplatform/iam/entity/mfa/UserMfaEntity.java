package com.metaplatform.iam.entity.mfa;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "iam_user_mfa")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserMfaEntity {

    public enum MfaType { TOTP, SMS, EMAIL, BACKUP_CODE, FIDO2 }

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Enumerated(EnumType.STRING)
    @Column(name = "mfa_type", nullable = false, length = 16)
    private MfaType mfaType;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "secret", length = 256)
    private String secret;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "user_id", nullable = false, length = 64)
    private String userId;

    @Column(name = "verified", nullable = false)
    private Boolean verified;

}
