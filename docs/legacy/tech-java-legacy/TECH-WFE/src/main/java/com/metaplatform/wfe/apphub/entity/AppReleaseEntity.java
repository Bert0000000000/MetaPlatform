package com.metaplatform.wfe.apphub.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;

@Entity
@Table(name = "wfe_app_release")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AppReleaseEntity {

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
    @Column(name = "release_notes", columnDefinition = "TEXT")
    private String releaseNotes;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "strategy", nullable = false, length = 32)
    private AppReleaseStrategy strategy;

    @Column(name = "gray_percent", nullable = false)
    private Integer grayPercent;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "gray_users", columnDefinition = "TEXT")
    private List<String> grayUsers;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "gray_depts", columnDefinition = "TEXT")
    private List<String> grayDepts;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 32)
    private AppReleaseStatus status;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "approval_status", nullable = false, length = 32)
    private ApprovalStatus approvalStatus;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "process_instance_id", length = 64)
    private String processInstanceId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "created_by", length = 64)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

}
