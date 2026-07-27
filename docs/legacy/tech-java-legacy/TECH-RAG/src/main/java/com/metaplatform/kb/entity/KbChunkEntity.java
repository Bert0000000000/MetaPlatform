package com.metaplatform.kb.entity;

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
@Table(name = "kb_chunk")
public class KbChunkEntity {
    @Id
    @Column(name = "chunk_id", length = 64)
    private String chunkId;
    @Column(name = "document_id", length = 64) private String documentId;
    @Column(name = "tenant_id", length = 64) private String tenantId;
    @Column(name = "content", columnDefinition = "TEXT") private String content;
    @Column(name = "chunk_index") private Integer chunkIndex;
    @Column(name = "metadata", columnDefinition = "jsonb") private String metadata;
    @Column(name = "created_at") private Instant createdAt;
}
