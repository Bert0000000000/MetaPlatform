package com.metaplatform.iam.entity;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * 审计字段基类：被所有需要审计的实体继承。
 * - tenantId：租户 ID，由 Service 层强制注入 tenant-default，DB 侧 NOT NULL 无默认值
 * - deleted：软删除标记
 * - createdAt / updatedAt：由 Hibernate 自动维护
 * - createdBy / updatedBy：由 Service 层从 SecurityContext 注入
 */
@Getter
@Setter
@NoArgsConstructor
@SuperBuilder
@MappedSuperclass
public abstract class AuditEntity {

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "deleted", nullable = false)
    private Boolean deleted = Boolean.FALSE;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "created_by", length = 64, updatable = false)
    private String createdBy;

    @Column(name = "updated_by", length = 64)
    private String updatedBy;
}