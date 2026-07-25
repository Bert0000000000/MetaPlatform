package com.metaplatform.iam.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "iam_users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserEntity {

    public enum UserStatus { ACTIVE, ENABLED, DISABLED, LOCKED, PENDING, ARCHIVED }

    @Id
    @Column(name = "id", nullable = false, length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String tenantId;

    @Column(name = "username", nullable = false, length = 128)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String username;

    @Column(name = "email", nullable = false, length = 256)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 256)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String passwordHash;

    @Column(name = "real_name", length = 256)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String realName;

    @Column(name = "phone", length = 32)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String phone;

    @Column(name = "avatar_url", length = 512)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String avatarUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private UserStatus status;

    @Column(name = "require_password_reset", nullable = false)
    private Boolean requirePasswordReset;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    public void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }
}