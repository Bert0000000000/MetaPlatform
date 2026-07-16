package com.metaplatform.iam.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "iam_permission")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class PermissionEntity extends AuditEntity {

    public enum Effect {
        ALLOW,
        DENY
    }

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "permission_code", nullable = false, length = 256)
    private String permissionCode;

    @Column(name = "permission_name", nullable = false, length = 256)
    private String permissionName;

    @Column(name = "resource_type", nullable = false, length = 64)
    private String resourceType;

    @Column(name = "resource_id", length = 64)
    private String resourceId;

    /**
     * 操作列表：JSON 数组字符串（["READ","CREATE",...]）。
     * Phase 2 简化：使用 TEXT 存储 JSON 字符串，避免引入 Hypersistence Utils。
     */
    @Column(name = "actions", nullable = false, columnDefinition = "TEXT")
    private String actions;

    @Enumerated(EnumType.STRING)
    @Column(name = "effect", nullable = false, length = 16)
    private Effect effect;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    /**
     * ABAC 条件表达式：JSON 字符串。
     */
    @Column(name = "conditions", columnDefinition = "TEXT")
    private String conditions;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version;
}