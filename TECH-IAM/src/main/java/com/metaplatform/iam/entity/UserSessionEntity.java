package com.metaplatform.iam.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "iam_user_sessions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserSessionEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String id;

    @Column(name = "user_id", nullable = false, length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String userId;

    @Column(name = "tenant_id", nullable = false, length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String tenantId;

    @Column(name = "refresh_token_hash", length = 256)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String refreshTokenHash;

    @Column(name = "user_agent", length = 512)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String userAgent;

    @Column(name = "ip_address", length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String ipAddress;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "last_active_at")
    private Instant lastActiveAt;

    @Column(name = "device", length = 256)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String device;

    @Column(name = "ip", length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String ip;

    @Column(name = "location", length = 256)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String location;

    @Column(name = "current", nullable = false)
    private Boolean current;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}