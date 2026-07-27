package com.metaplatform.ont.draft;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Ontology Draft 实体（P1.3.1）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "ont_draft")
public class OntologyDraftEntity {

    @Id
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "base_version", nullable = false, length = 32)
    private String baseVersion;

    @Column(name = "target_version", nullable = false, length = 32)
    private String targetVersion;

    @Column(name = "draft_kind", nullable = false, length = 32)
    private String draftKind;

    @Column(nullable = false, length = 64)
    private String source;

    @Column(name = "source_run_id", length = 64)
    private String sourceRunId;

    @Column(columnDefinition = "TEXT")
    private String summary;

    @Column(nullable = false, length = 16)
    private String status;

    @Column(length = 64)
    private String reviewer;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(name = "committed_at")
    private Instant committedAt;

    @Column(name = "commit_id", length = 64)
    private String commitId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public enum Status { DRAFT, PENDING_REVIEW, APPROVED, REJECTED, COMMITTED }
    public enum Source { USER, AGENT, SYSTEM }
    public enum DraftKind { CONCEPT, OBJECT, METRIC, ACTION }
}
