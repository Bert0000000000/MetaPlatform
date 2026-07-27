package com.metaplatform.agent.artifact;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "agent_artifact")
public class ArtifactEntity {
    @Id private String id;
    @Column(name="tenant_id", nullable=false, length=64) private String tenantId;
    @Column(name="run_id", nullable=false, length=64) private String runId;
    @Column(name="agent_id", length=64) private String agentId;
    @Column(name="artifact_kind", nullable=false, length=32) private String artifactKind;
    @Column(name="display_name", nullable=false, length=256) private String displayName;
    @Column(name="storage_bucket", nullable=false, length=128) private String storageBucket;
    @Column(name="storage_key", nullable=false, length=512) private String storageKey;
    @Column(name="mime_type", length=64) private String mimeType;
    @Column(name="byte_size") private Long byteSize;
    @Column(columnDefinition = "TEXT") private String metadata;
    @Column(name="created_at", nullable=false, updatable=false) private Instant createdAt;

    // ====== V8 attestation extension (主文档 §5.6 + 契约 C) ======
    // 以下 12 个字段由 V8__init_agent_artifacts.sql 追加；本类仅同步字段定义，
    // 不删除任何已有字段、不改任何 method（Lombok @Data/@Builder/@AllArgsConstructor
    // 会自动适配新增字段）。
    @Column(name="sha256", length=64) private String sha256;
    @Column(name="scan_status", length=16) private String scanStatus;
    @Column(name="flagged_reasons", columnDefinition = "TEXT") private String flaggedReasons;
    @Column(name="produced_by_skill_id", length=128) private String producedBySkillId;
    @Column(name="evidence_refs", columnDefinition = "TEXT") private String evidenceRefs;
    @Column(name="signed_url", columnDefinition = "TEXT") private String signedUrl;
    @Column(name="signed_url_expires_at") private Instant signedUrlExpiresAt;
    @Column(name="revoked", nullable=false) private boolean revoked;
    @Column(name="revoked_at") private Instant revokedAt;
    @Column(name="revoked_by", length=128) private String revokedBy;
    @Column(name="revoked_reason", columnDefinition = "TEXT") private String revokedReason;
    @Column(name="expires_at") private Instant expiresAt;
}
