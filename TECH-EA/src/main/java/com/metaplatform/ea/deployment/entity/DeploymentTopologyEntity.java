package com.metaplatform.ea.deployment.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.UUID;
import java.time.Instant;

@Entity
@Table(name = "ea_deployment_topology")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeploymentTopologyEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "name", nullable = false, length = 256)
    private String name;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "environment", nullable = false, length = 64)
    private String environment;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "nodes", columnDefinition = "jsonb")
    private java.util.List<com.metaplatform.ea.deployment.dto.DeploymentNode> nodes;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "edges", columnDefinition = "jsonb")
    private java.util.List<com.metaplatform.ea.deployment.dto.DeploymentEdge> edges;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "health_status", nullable = false, length = 32)
    private String healthStatus;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

}
