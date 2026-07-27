package com.metaplatform.data.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

@Entity
@Table(name = "etl_task")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EtlTaskEntity {

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "name", nullable = false, length = 128)
    private String name;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "description", length = 1024)
    private String description;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "source_ds_id", nullable = false, length = 64)
    private String sourceDsId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "target_ds_id", length = 64)
    private String targetDsId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "target_table", length = 256)
    private String targetTable;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "engine", nullable = false, length = 32)
    private String engine;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "config", nullable = false, columnDefinition = "jsonb")
    private String config;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "schedule_cron", length = 64)
    private String scheduleCron;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "last_run_id", length = 64)
    private String lastRunId;

    @Column(name = "last_run_at")
    private OffsetDateTime lastRunAt;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "last_run_status", length = 32)
    private String lastRunStatus;

    @Column(name = "rows_processed")
    private Long rowsProcessed;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "created_by", nullable = false, length = 64)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

}
