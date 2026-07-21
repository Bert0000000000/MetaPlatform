package com.metaplatform.mcp.external.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "mcp_external_agent")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExternalAgentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(nullable = false, length = 256)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, length = 2048)
    private String endpoint;

    @Column(name = "protocol_type", nullable = false, length = 20)
    private String protocolType;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "trust_level", nullable = false, length = 20)
    private String trustLevel;

    @Column(name = "auth_type", length = 20)
    private String authType;

    @Column(name = "auth_config", columnDefinition = "TEXT")
    private String authConfig;

    @Column(columnDefinition = "TEXT")
    private String capabilities;

    @Column(name = "last_connected_at")
    private Instant lastConnectedAt;

    @Column(name = "last_error_message", columnDefinition = "TEXT")
    private String lastErrorMessage;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
