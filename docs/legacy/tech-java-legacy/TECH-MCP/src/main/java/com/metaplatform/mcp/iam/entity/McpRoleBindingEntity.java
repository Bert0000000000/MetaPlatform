package com.metaplatform.mcp.iam.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "mcp_role_binding")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class McpRoleBindingEntity {

    @Id
    @Column(length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "role_id", nullable = false, length = 64)
    private String roleId;

    @Column(name = "subject_type", nullable = false, length = 16)
    private String subjectType;

    @Column(name = "subject_id", nullable = false, length = 64)
    private String subjectId;

    @Column(name = "resource_scope", nullable = false, length = 32)
    @Builder.Default
    private String resourceScope = "TENANT";

    @Column(name = "resource_id", length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String resourceId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}