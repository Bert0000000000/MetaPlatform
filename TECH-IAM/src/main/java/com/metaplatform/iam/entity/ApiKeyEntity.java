package com.metaplatform.iam.entity;

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

/**
 * API Key 实体。
 * - key_prefix：明文 Key 前 8 位，用于展示
 * - key_hash：SHA-256 哈希，用于验证
 * - status：ACTIVE / REVOKED
 */
@Entity
@Table(name = "iam_api_keys")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApiKeyEntity {

    public enum Status {
        ACTIVE,
        REVOKED
    }

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "name", nullable = false, length = 128)
    private String name;

    @Column(name = "key_prefix", nullable = false, length = 8)
    private String keyPrefix;

    @Column(name = "key_hash", nullable = false, length = 128)
    private String keyHash;

    @Column(name = "user_id", nullable = false, length = 64)
    private String userId;

    /**
     * JSON 数组字符串，如 ["ont:read","iam:write"]。
     */
    @Column(name = "scopes", columnDefinition = "TEXT")
    private String scopes;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private Status status;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
