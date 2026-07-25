package com.metaplatform.mcp.externalapp.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 外部应用配置实体（限流 / 超时 / 工具黑白名单 / webhook / metadata）。
 * app_id 对应 mcp_external_agent.id（UUID 字符串）。
 */
@Entity
@Table(name = "mcp_app_configs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class McpAppConfigEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String tenantId;

    @Column(name = "app_id", nullable = false, length = 64)
    private String appId;

    @Column(name = "rate_limit_qps")
    private Integer rateLimitQps;

    @Column(name = "timeout_ms")
    private Integer timeoutMs;

    @Column(name = "allowed_tools", columnDefinition = "TEXT")
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String allowedTools;

    @Column(name = "denied_tools", columnDefinition = "TEXT")
    private String deniedTools;

    @Column(name = "webhook_url", length = 512)
    private String webhookUrl;

    @Column(columnDefinition = "TEXT")
    private String metadata;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
