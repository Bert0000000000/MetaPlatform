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
@Table(name = "iam_data_permission")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class DataPermissionEntity extends AuditEntity {

    public enum DataScope {
        ALL,
        DEPT,
        DEPT_AND_SUB,
        SELF
    }

    public enum Effect {
        ALLOW,
        DENY
    }

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "role_id", nullable = false, length = 64)
    private String roleId;

    @Column(name = "resource_type", nullable = false, length = 64)
    private String resourceType;

    @Column(name = "resource_id", length = 64)
    private String resourceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "data_scope", nullable = false, length = 16)
    private DataScope dataScope;

    /**
     * 列级脱敏配置：JSON 数组字符串（["salary","id_card"]）。
     */
    @Column(name = "column_filter", columnDefinition = "TEXT")
    private String columnFilter;

    @Enumerated(EnumType.STRING)
    @Column(name = "effect", nullable = false, length = 8)
    private Effect effect;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version;
}
