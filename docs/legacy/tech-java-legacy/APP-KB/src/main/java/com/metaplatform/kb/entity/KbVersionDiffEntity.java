package com.metaplatform.kb.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "kb_version_diffs")
@Data
public class KbVersionDiffEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private String diffId;
    private String kbId;
    private String fromVersion;
    private String toVersion;
    private String diffType;
    @Column(columnDefinition = "TEXT") private String changes;
    private LocalDateTime createdAt;
    @PrePersist void create() { if (diffId == null) diffId = java.util.UUID.randomUUID().toString(); if (createdAt == null) createdAt = LocalDateTime.now(); }
}
