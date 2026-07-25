package com.metaplatform.mcp.server.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "mcp_server")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class McpServerEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String tenantId;

    @Column(nullable = false, length = 256)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String name;

    @Column(nullable = false, length = 128)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String code;

    @Column(columnDefinition = "TEXT")
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    private String description;

    @Column(name = "transport_type", nullable = false, length = 20)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String transportType;

    @Column(name = "endpoint_url", length = 2048)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String endpointUrl;

    @Column(length = 256)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String host;

    @Column
    private Integer port;

    @Column(name = "sse_endpoint", length = 2048)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String sseEndpoint;

    @Column(name = "auth_type", length = 20)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String authType;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "auth_config", columnDefinition = "jsonb")
    private String authConfig;

    @Column(name = "timeout_ms")
    private Integer timeoutMs;

    @Column(name = "max_concurrent_calls")
    private Integer maxConcurrentCalls;

    @Column(name = "health_check_url", length = 2048)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String healthCheckUrl;

    @Column(name = "last_heartbeat_at")
    private Instant lastHeartbeatAt;

    @Column(name = "last_error_message", columnDefinition = "TEXT")
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    private String lastErrorMessage;

    @Column(nullable = false, length = 20)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String status;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "config", columnDefinition = "jsonb")
    private String config;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
