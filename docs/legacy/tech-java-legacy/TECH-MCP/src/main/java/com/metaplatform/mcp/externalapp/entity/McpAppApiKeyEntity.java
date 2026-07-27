package com.metaplatform.mcp.externalapp.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 外部应用 API Key 实体。
 * 与 mcp_api_key（V15 平台级 API Key）分离，绑定到 external-agent。
 * key_hash 使用 BCrypt；明文 secret 仅在创建时返回一次。
 */
@Entity
@Table(name = "mcp_app_api_keys")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class McpAppApiKeyEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String tenantId;

    @Column(name = "app_id", nullable = false, length = 64)
    private String appId;

    @Column(name = "key_id", nullable = false, unique = true, length = 64)
    private String keyId;

    @Column(name = "key_hash", nullable = false, length = 128)
    private String keyHash;

    @Column(length = 128)
    private String name;

    @Column(nullable = false, length = 16)
    @Builder.Default
    private String status = "ACTIVE";

    @Column(name = "last_used_at")
    private OffsetDateTime lastUsedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
