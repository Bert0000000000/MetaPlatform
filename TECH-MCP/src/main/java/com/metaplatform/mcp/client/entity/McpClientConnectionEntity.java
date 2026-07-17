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
    private String tenantId;

    @Column(nullable = false, length = 256)
    private String name;

    @Column(name = "server_url", nullable = false, length = 2048)
    private String serverUrl;

    @Column(name = "transport_type", nullable = false, length = 20)
    private String transportType;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "last_connected_at")
    private Instant lastConnectedAt;

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
