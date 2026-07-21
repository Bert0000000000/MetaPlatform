package com.metaplatform.wfe.apphub.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * 应用版本实体（V11-08）：记录 APP-APPHUB 中每个应用的版本快照、变更日志与生命周期状态。
 * 状态流转：DRAFT -> PUBLISHED -> OFFLINE；ROLLBACK 用于标识因回滚产生的版本。
 */
@Entity
@Table(name = "wfe_app_version",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_wfe_appv_tenant_app_version",
                columnNames = {"tenant_id", "app_id", "version"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AppVersionEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "app_id", nullable = false, length = 64)
    private String appId;

    @Column(name = "version", nullable = false, length = 64)
    private String version;

    @Column(name = "change_log", columnDefinition = "TEXT")
    private String changeLog;

    @Column(name = "snapshot", nullable = false, columnDefinition = "TEXT")
    private String snapshot;

    @Column(name = "status", nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private AppVersionStatus status = AppVersionStatus.DRAFT;

    @Column(name = "published_by", length = 64)
    private String publishedBy;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "rolled_back_by", length = 64)
    private String rolledBackBy;

    @Column(name = "rolled_back_at")
    private Instant rolledBackAt;

    @Column(name = "created_by", length = 64)
    private String createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
