package com.metaplatform.iam.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "iam_permission")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PermissionEntity {

    public enum Effect { ALLOW, DENY }

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "permission_code", nullable = false, length = 256)
    private String permissionCode;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "permission_name", nullable = false, length = 256)
    private String permissionName;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "resource_type", nullable = false, length = 64)
    private String resourceType;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "resource_id", length = 64)
    private String resourceId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "actions", nullable = false, columnDefinition = "TEXT")
    private String actions;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Enumerated(EnumType.STRING)
    @Column(name = "effect", nullable = false, length = 16)
    private Effect effect;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "conditions", columnDefinition = "TEXT")
    private String conditions;

    @Column(name = "version", nullable = false)
    private Integer version;

    @Column(name = "deleted", nullable = false)
    private Boolean deleted;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "created_by", length = 64)
    private String createdBy;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "updated_by", length = 64)
    private String updatedBy;

    @PrePersist
    public void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }
}