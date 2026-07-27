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
@Table(name = "kb_retrieval_config")
public class KbRetrievalConfigEntity {

    @Id
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "kb_id", nullable = false, length = 64)
    private String kbId;

    @Column(name = "top_k", nullable = false)
    private int topK;

    @Column(nullable = false)
    private double threshold;

    @Column(name = "hybrid_alpha", nullable = false)
    private double hybridAlpha;

    @Column(nullable = false)
    private boolean rerank;

    @Column(name = "rerank_model", length = 128)
    private String rerankModel;

    @Column(name = "ontology_filter", columnDefinition = "TEXT")
    private String ontologyFilter;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
