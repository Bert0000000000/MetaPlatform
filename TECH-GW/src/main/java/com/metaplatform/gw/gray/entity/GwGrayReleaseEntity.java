package com.metaplatform.gw.gray.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "gw_gray_release")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GwGrayReleaseEntity {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "tenant_id", length = 64)
    private String tenantId;

    @Column(name = "api_id")
    private UUID apiId;

    @Column(name = "name", length = 256, nullable = false)
    private String name;

    @Column(name = "status", length = 32, nullable = false)
    private String status;

    @Column(name = "strategy", length = 32, nullable = false)
    private String strategy;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "strategy_config", columnDefinition = "jsonb")
    private Map<String, Object> strategyConfig;

    @Column(name = "new_version", length = 32)
    private String newVersion;

    @Column(name = "old_version", length = 32)
    private String oldVersion;

    @Column(name = "start_at")
    private LocalDateTime startAt;

    @Column(name = "end_at")
    private LocalDateTime endAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;
}
