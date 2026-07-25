package com.metaplatform.mcp.iam.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "mcp_api_key")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class McpApiKeyEntity {

    @Id
    @Column(length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "key_id", nullable = false, unique = true, length = 64)
    private String keyId;

    @Column(name = "key_hash", nullable = false, length = 256)
    private String keyHash;

    @Column(name = "user_id", length = 64)
    private String userId;

    @Column(nullable = false, length = 32)
    private String status;

    @Column(nullable = false)
    private Boolean enabled;

    @Column(name = "scopes", columnDefinition = "TEXT")
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String scopes;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}