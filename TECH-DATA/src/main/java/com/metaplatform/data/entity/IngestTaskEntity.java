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
@Table(name = "ingest_task")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IngestTaskEntity {

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
    @Column(name = "source_ds_id", nullable = false, length = 64)
    private String sourceDsId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "target_table_id", nullable = false, length = 64)
    private String targetTableId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "mode", nullable = false, length = 32)
    private String mode;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "cdc_mode", length = 32)
    private String cdcMode;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "schedule_cron", length = 64)
    private String scheduleCron;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Column(name = "last_run_at")
    private OffsetDateTime lastRunAt;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "last_run_status", length = 32)
    private String lastRunStatus;

    @Column(name = "last_run_rows")
    private Long lastRunRows;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

}
