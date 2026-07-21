package com.metaplatform.wfe.apphub.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * 模板评论与评分实体（V11-08）：用户对市场模板提交的评分（1~5）和评论内容，
 * 同一用户对同一模板仅保留最新一条记录（通过 (tenant_id, template_id, user_id) 唯一约束保证）。
 */
@Entity
@Table(name = "wfe_apphub_template_comment",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_wfe_tmpl_comment_tenant_template_user",
                columnNames = {"tenant_id", "template_id", "user_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TemplateCommentEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "template_id", nullable = false, length = 64)
    private String templateId;

    @Column(name = "user_id", nullable = false, length = 64)
    private String userId;

    @Column(name = "rating", nullable = false)
    private Integer rating;

    @Column(name = "comment", columnDefinition = "TEXT")
    private String comment;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
