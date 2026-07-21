package com.metaplatform.wfe.form.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * 表单定义实体（V13-13）：扩展表单的全局设置、数据联动规则与脚本能力。
 * 以 moduleId 为业务主键，与 APP-APPHUB 的表单模块一一对应。
 */
@Entity
@Table(name = "wfe_form_definition",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_wfe_form_tenant_module",
                columnNames = {"tenant_id", "id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FormDefinitionEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "app_id", length = 64)
    private String appId;

    @Column(name = "global_settings", columnDefinition = "TEXT")
    private String globalSettings;

    @Column(name = "linkage_rules", columnDefinition = "TEXT")
    private String linkageRules;

    @Column(name = "scripts", columnDefinition = "TEXT")
    private String scripts;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
