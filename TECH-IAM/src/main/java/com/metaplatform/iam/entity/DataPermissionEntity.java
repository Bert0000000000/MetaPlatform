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
@Table(name = "iam_data_permission")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DataPermissionEntity {

    public enum DataScope { SELF, DEPARTMENT, DEPARTMENT_TREE, ALL, CUSTOM }

    public enum Effect { ALLOW, DENY }

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "role_id", nullable = false, length = 64)
    private String roleId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "resource_type", nullable = false, length = 64)
    private String resourceType;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "resource_id", length = 64)
    private String resourceId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Enumerated(EnumType.STRING)
    @Column(name = "data_scope", nullable = false, length = 16)
    private DataScope dataScope;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "column_filter", columnDefinition = "TEXT")
    private String columnFilter;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Enumerated(EnumType.STRING)
    @Column(name = "effect", nullable = false, length = 8)
    private Effect effect;

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

}
