package com.metaplatform.wfe.apphub.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * 市场模板实体（V11-08）：可被安装到租户应用列表的预置模板。
 */
@Entity
@Table(name = "wfe_apphub_template",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_wfe_tmpl_tenant_template_id",
                columnNames = {"tenant_id", "template_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TemplateEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "template_id", nullable = false, length = 64)
    private String templateId;

    @Column(name = "name", nullable = false, length = 256)
    private String name;

    @Column(name = "category", nullable = false, length = 32)
    private String category;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "icon", length = 512)
    private String icon;

    @Column(name = "tags", length = 1024)
    private String tags;

    @Column(name = "config_snapshot", columnDefinition = "TEXT")
    private String configSnapshot;

    @Column(name = "preview", length = 1024)
    private String preview;

    @Column(name = "download_count", nullable = false)
    @Builder.Default
    private Long downloadCount = 0L;

    @Column(name = "rating_sum", nullable = false)
    @Builder.Default
    private Long ratingSum = 0L;

    @Column(name = "rating_count", nullable = false)
    @Builder.Default
    private Long ratingCount = 0L;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    @UpdateTimestamp
    private Instant updatedAt;
}
