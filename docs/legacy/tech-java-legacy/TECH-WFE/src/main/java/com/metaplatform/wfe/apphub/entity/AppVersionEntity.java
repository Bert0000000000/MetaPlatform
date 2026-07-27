package com.metaplatform.wfe.apphub.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "wfe_app_version")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AppVersionEntity {

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "app_id", nullable = false, length = 64)
    private String appId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "version", nullable = false, length = 64)
    private String version;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "change_log", columnDefinition = "TEXT")
    private String changeLog;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "snapshot", nullable = false, columnDefinition = "TEXT")
    private String snapshot;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 32)
    private AppVersionStatus status;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "published_by", length = 64)
    private String publishedBy;

    @Column(name = "published_at")
    private Instant publishedAt;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "rolled_back_by", length = 64)
    private String rolledBackBy;

    @Column(name = "rolled_back_at")
    private Instant rolledBackAt;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "created_by", length = 64)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

}
