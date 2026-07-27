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
@Table(name = "kb_document")
public class KbDocumentEntity {

    @Id
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "kb_id", nullable = false, length = 64)
    private String kbId;

    @Column(name = "document_code", nullable = false, length = 128)
    private String documentCode;

    @Column(nullable = false, length = 512)
    private String title;

    @Column(name = "source_uri", columnDefinition = "TEXT")
    private String sourceUri;

    @Column(name = "mime_type", length = 64)
    private String mimeType;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "storage_key", length = 512)
    private String storageKey;

    @Column(name = "storage_bucket", length = 128)
    private String storageBucket;

    @Column(name = "strategy_id", length = 64)
    private String strategyId;

    @Column(nullable = false, length = 32)
    private String status;

    @Column(name = "parse_error", columnDefinition = "TEXT")
    private String parseError;

    @Column(name = "chunk_count", nullable = false)
    private int chunkCount;

    @Column(nullable = false)
    private int version;

    @Column(columnDefinition = "TEXT")
    private String metadata;

    @Column(nullable = false)
    private boolean deleted;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public enum Status { UPLOADED, PARSING, CHUNKING, EMBEDDING, READY, FAILED }
}
