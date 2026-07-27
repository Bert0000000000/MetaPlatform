package com.metaplatform.ont.diff;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Ontology Version Diff 实体（P1.1.5）。
 *
 * <p>每次 Commit 都保存前后快照差异（结构化 JSON）。用于：
 * <ul>
 *   <li>前端展示 Diff 视图</li>
 *   <li>审计回放</li>
 *   <li>回滚决策</li>
 * </ul>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "ont_version_diff")
public class VersionDiffEntity {

    @Id
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "from_version", length = 32)
    private String fromVersion;

    @Column(name = "to_version", nullable = false, length = 32)
    private String toVersion;

    @Column(name = "diff_type", nullable = false, length = 32)
    private String diffType;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String changes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public enum DiffType {
        CONCEPT_ADDED, CONCEPT_MODIFIED, CONCEPT_REMOVED,
        OBJECT_CHANGED, METRIC_ADDED, METRIC_MODIFIED,
        ACTION_ADDED, ACTION_MODIFIED
    }
}
