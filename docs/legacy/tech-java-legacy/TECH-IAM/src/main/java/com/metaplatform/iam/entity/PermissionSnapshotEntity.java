package com.metaplatform.iam.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * PermissionSnapshot 实体。
 *
 * <p>用途：把"用户 × 业务对象"对应的权限集合（对象级 / 字段级 / 关系级 / Action 级 / 数据范围），
 * 在 Ontology Context Envelope 注入到 DeerFlow / Agent / RAG 之前固化为一份快照。
 * 快照带签名 + TTL，下游可信赖地使用而不需要每次重新查询 IAM。</p>
 *
 * <p>见 docs/superpowers/specs/2026-07-26-ontology-native-deerflow-rollout-roadmap.md
 * 中 P0.2.1 与 P1.2.3。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "iam_permission_snapshot")
public class PermissionSnapshotEntity {

    @Id
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "user_id", nullable = false, length = 64)
    private String userId;

    @Column(name = "subject_concept", nullable = false, length = 64)
    private String subjectConcept;

    @Column(name = "subject_id", nullable = false, length = 64)
    private String subjectId;

    @Column(name = "snapshot_data", nullable = false, columnDefinition = "TEXT")
    private String snapshotData;

    @Column(name = "signature", nullable = false, length = 256)
    private String signature;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked", nullable = false)
    private boolean revoked;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
