package com.metaplatform.wfe.apphub.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * 模板安装记录实体（V11-08）：记录租户对市场模板的安装行为，用于防止重复安装与下载量统计。
 */
@Entity
@Table(name = "wfe_apphub_template_install",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_wfe_tmpl_install_tenant_template",
                columnNames = {"tenant_id", "template_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TemplateInstallEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "template_id", nullable = false, length = 64)
    private String templateId;

    @Column(name = "app_id", length = 64)
    private String appId;

    @Column(name = "installed_by", length = 64)
    private String installedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
