package com.metaplatform.gw.gray.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;
import java.util.UUID;
import java.time.Instant;

@Entity
@Table(name = "gw_gray_release")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GwGrayReleaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", length = 64)
    private String tenantId;

    @Column(name = "api_id")
    private UUID apiId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "name", nullable = false, length = 256)
    private String name;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "strategy", nullable = false, length = 32)
    private String strategy;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "strategy_config", columnDefinition = "jsonb")
    private Map<String, Object> strategyConfig;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "new_version", length = 32)
    private String newVersion;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "old_version", length = 32)
    private String oldVersion;

    @Column(name = "start_at")
    private Instant startAt;

    @Column(name = "end_at")
    private Instant endAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

}
