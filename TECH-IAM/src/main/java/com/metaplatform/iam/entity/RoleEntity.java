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
@Table(name = "iam_role")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoleEntity {

    public enum RoleType { SYSTEM, CUSTOM, BUILTIN, EXTERNAL }

    public enum DataScope { SELF, DEPARTMENT, DEPARTMENT_TREE, ALL, CUSTOM }

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "role_code", nullable = false, length = 128)
    private String roleCode;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "role_name", nullable = false, length = 256)
    private String roleName;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Enumerated(EnumType.STRING)
    @Column(name = "role_type", nullable = false, length = 32)
    private RoleType roleType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Enumerated(EnumType.STRING)
    @Column(name = "data_scope", nullable = false, length = 32)
    private DataScope dataScope;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled;

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
