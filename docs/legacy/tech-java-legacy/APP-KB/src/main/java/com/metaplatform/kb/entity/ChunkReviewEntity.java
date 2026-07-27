package com.metaplatform.kb.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "kb_chunk_reviews")
@Data
public class ChunkReviewEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private String reviewId;
    private String kbId;
    private String documentId;
    private String chunkId;
    @Column(columnDefinition = "TEXT") private String content;
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String status;
    private String reviewedBy;
    private LocalDateTime reviewedAt;
    @Column(columnDefinition = "TEXT") private String comment;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    @PrePersist void create() { if (reviewId == null) reviewId = java.util.UUID.randomUUID().toString(); if (status == null) status = "PENDING"; createdAt = updatedAt = LocalDateTime.now(); }
    @PreUpdate void update() { updatedAt = LocalDateTime.now(); }
}
