package com.metaplatform.ragmdm.domain;

import com.metaplatform.ragmdm.domain.enums.KnowledgeBaseStatus;
import com.metaplatform.ragmdm.domain.enums.KnowledgeBaseType;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "knowledge_base")
@Data
@NoArgsConstructor
public class KnowledgeBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String name;

    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private KnowledgeBaseType type;

    @Column(name = "chunk_size")
    private Integer chunkSize;

    @Column(name = "chunk_overlap")
    private Integer chunkOverlap;

    @Column(name = "embedding_model")
    private String embeddingModel;

    @Column(name = "document_count")
    private Long documentCount;

    @Column(name = "chunk_count")
    private Long chunkCount;

    @Enumerated(EnumType.STRING)
    private KnowledgeBaseStatus status;

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
        if (documentCount == null) documentCount = 0L;
        if (chunkCount == null) chunkCount = 0L;
        if (status == null) status = KnowledgeBaseStatus.ACTIVE;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
