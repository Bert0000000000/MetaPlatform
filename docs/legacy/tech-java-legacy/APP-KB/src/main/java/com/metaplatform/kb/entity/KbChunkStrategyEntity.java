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
@Table(name = "kb_chunk_strategy")
public class KbChunkStrategyEntity {

    @Id
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "strategy_code", nullable = false, length = 128)
    private String strategyCode;

    @Column(name = "display_name", nullable = false, length = 256)
    private String displayName;

    @Column(name = "strategy_kind", nullable = false, length = 32)
    private String strategyKind;

    @Column(name = "chunk_size", nullable = false)
    private int chunkSize;

    @Column(nullable = false)
    private int overlap;

    @Column(name = "split_chars", columnDefinition = "TEXT")
    private String splitChars;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public enum Kind { PARAGRAPH, HEADING, TOKEN, SENTENCE }
}
