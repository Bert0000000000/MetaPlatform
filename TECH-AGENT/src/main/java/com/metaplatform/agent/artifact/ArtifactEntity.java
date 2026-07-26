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
}
