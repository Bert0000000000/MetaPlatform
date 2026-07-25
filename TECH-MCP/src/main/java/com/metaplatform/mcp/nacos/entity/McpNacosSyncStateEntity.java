package com.metaplatform.mcp.nacos.entity;

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

@Entity
@Table(name = "mcp_nacos_sync_state")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class McpNacosSyncStateEntity {

    @Id
    @Column(length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "entity_type", nullable = false, length = 32)
    private String entityType;

    @Column(name = "entity_id", nullable = false, length = 64)
    private String entityId;

    @Column(name = "nacos_group", nullable = false, length = 64)
    private String nacosGroup;

    @Column(name = "nacos_data_id", nullable = false, length = 128)
    private String nacosDataId;

    @Column(name = "sync_status", nullable = false, length = 16)
    @Builder.Default
    private String syncStatus = "PENDING";

    @Column(name = "last_synced_at")
    private OffsetDateTime lastSyncedAt;

    @Column(name = "last_error", columnDefinition = "TEXT")
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String lastError;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}