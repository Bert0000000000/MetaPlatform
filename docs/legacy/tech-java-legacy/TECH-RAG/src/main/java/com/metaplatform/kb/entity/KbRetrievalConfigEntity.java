package com.metaplatform.kb.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
@lombok.Builder
@lombok.Data
@lombok.NoArgsConstructor
@lombok.AllArgsConstructor
@Entity
@Table(name = "kb_retrieval_config")
public class KbRetrievalConfigEntity {
    @Id @Column(name = "config_id", length = 64) private String configId;
    @Column(name = "tenant_id", length = 64) private String tenantId;
    @Column(name = "name", length = 128) private String name;
    @Column(name = "strategy", length = 32) private String strategy;
    @Column(name = "top_k") private Integer topK;
    @Column(name = "threshold") private Double threshold;
    @Column(name = "metadata", columnDefinition = "jsonb") private String metadata;
}
