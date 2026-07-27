package com.metaplatform.mcp.permission.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * MCP 权限规则实体（RBAC + ABAC 混合）。
 * 一条规则描述：某 subject（USER/ROLE/AGENT/EXTERNAL_APP）对某 resource（TOOL/RESOURCE/PROMPT/SERVER）
 * 的 actions（execute,read,list）的 effect（ALLOW/DENY）。
 * resourceId 为 NULL 表示通配该 resourceType 下所有资源。
 */
@Entity
@Table(name = "mcp_permission_rules")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class McpPermissionRuleEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String tenantId;

    @Column(name = "rule_id", nullable = false, unique = true, length = 64)
    private String ruleId;

    @Column(nullable = false, length = 128)
    private String name;

    @Column(name = "subject_type", nullable = false, length = 16)
    private String subjectType;

    @Column(name = "subject_id", nullable = false, length = 64)
    private String subjectId;

    @Column(name = "resource_type", nullable = false, length = 16)
    private String resourceType;

    @Column(name = "resource_id", length = 64)
    private String resourceId;

    @Column(nullable = false, length = 128)
    private String actions;

    @Column(nullable = false, length = 8)
    private String effect;

    @Column(nullable = false)
    @Builder.Default
    private Integer priority = 0;

    @Column(nullable = false)
    @Builder.Default
    private Boolean enabled = Boolean.TRUE;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
