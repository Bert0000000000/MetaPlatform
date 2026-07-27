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
@Table(name = "dbt_project")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DbtProjectEntity {

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
    @Column(name = "target_ds_id", nullable = false, length = 64)
    private String targetDsId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "project_path", nullable = false, length = 512)
    private String projectPath;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "profiles_path", length = 512)
    private String profilesPath;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "target_name", length = 64)
    private String targetName;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Column(name = "last_run_at")
    private OffsetDateTime lastRunAt;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "last_run_status", length = 32)
    private String lastRunStatus;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

}
