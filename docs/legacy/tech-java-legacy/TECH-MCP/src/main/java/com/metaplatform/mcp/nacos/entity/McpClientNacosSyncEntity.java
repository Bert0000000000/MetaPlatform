package com.metaplatform.mcp.nacos.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

@Entity
@Table(name = "mcp_client_nacos_sync")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class McpClientNacosSyncEntity {

    @Id
    @Column(length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String id;

    @Column(name = "client_id", nullable = false, length = 64, unique = true)
    private String clientId;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "server_url", nullable = false, length = 512)
    private String serverUrl;

    @Lob
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "discovered_tools", columnDefinition = "jsonb")
    @Builder.Default
    private String discoveredTools = "[]";

    @Column(name = "last_discovery_at")
    private OffsetDateTime lastDiscoveryAt;

    @Column(name = "last_heartbeat_at")
    private OffsetDateTime lastHeartbeatAt;

    @Column(name = "discovery_status", nullable = false, length = 16)
    @Builder.Default
    private String discoveryStatus = "PENDING";
}