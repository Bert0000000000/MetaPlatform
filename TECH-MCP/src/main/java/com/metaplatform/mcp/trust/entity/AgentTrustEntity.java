package com.metaplatform.mcp.trust.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "mcp_agent_trust")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentTrustEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "agent_id", nullable = false)
    private UUID agentId;

    @Column(name = "trust_level", nullable = false, length = 20)
    private String trustLevel;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(name = "allowed_operations", columnDefinition = "TEXT")
    private String allowedOperations;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
