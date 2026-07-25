package com.metaplatform.dw.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "dw_retrieval_config")
@Data
public class RetrievalConfigEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String configId;
    private String employeeId;
    private Integer topK = 10;
    private Double scoreThreshold = 0.7;
    private Boolean enableRerank = true;
    private Integer maxCitations = 5;
    private Boolean enableStreaming = true;
    private String strategy = "HYBRID";
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (configId == null) configId = java.util.UUID.randomUUID().toString();
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}