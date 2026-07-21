package com.metaplatform.wfe.apphub.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * 应用发布记录实体（V14-05）：记录 APP-APPHUB 中每个应用版本的发布申请、
 * 灰度策略、审批状态及关联的流程实例。
 */
@Entity
@Table(name = "wfe_app_release",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_wfe_apprel_tenant_app_version",
                columnNames = {"tenant_id", "app_id", "version"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AppReleaseEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "app_id", nullable = false, length = 64)
    private String appId;

    @Column(name = "version", nullable = false, length = 64)
    private String version;

    @Column(name = "release_notes", columnDefinition = "TEXT")
    private String releaseNotes;

    @Column(name = "strategy", nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private AppReleaseStrategy strategy = AppReleaseStrategy.FULL;

    @Column(name = "gray_percent", nullable = false)
    @Builder.Default
    private Integer grayPercent = 0;

    @Column(name = "gray_users", columnDefinition = "TEXT")
    private String grayUsers;

    @Column(name = "gray_depts", columnDefinition = "TEXT")
    private String grayDepts;

    @Column(name = "status", nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private AppReleaseStatus status = AppReleaseStatus.PENDING_APPROVAL;

    @Column(name = "approval_status", nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ApprovalStatus approvalStatus = ApprovalStatus.PENDING;

    @Column(name = "process_instance_id", length = 64)
    private String processInstanceId;

    @Column(name = "created_by", length = 64)
    private String createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
