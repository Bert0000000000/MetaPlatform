package com.metaplatform.mcp.client.entity;

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
@Table(name = "mcp_client_connection")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class McpClientConnectionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String tenantId;

    @Column(name = "client_type", nullable = false, length = 32)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String clientType;

    @Column(name = "name", length = 200)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String name;

    @Column(name = "base_url", length = 2048)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String baseUrl;

    @Column(name = "server_url", length = 2048)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String serverUrl;

    @Column(name = "transport_type", length = 20)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String transportType;

    @Column(name = "auth_type", length = 20)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String authType;

    @Column(name = "auth_token", length = 512)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String authToken;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "headers", columnDefinition = "jsonb")
    private String headers;

    @Column(name = "timeout_ms")
    private Integer timeoutMs;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "config", columnDefinition = "jsonb")
    private String config;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "server_ids", columnDefinition = "jsonb")
    private String serverIds;

    @Column(name = "last_connected_at")
    private Instant lastConnectedAt;

    @Column(name = "status", length = 20)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
