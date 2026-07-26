package com.metaplatform.ont.metric;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Ontology 语义指标（P1.1.3）。
 *
 * <p>见 docs/superpowers/specs/2026-07-26-ontology-native-deerflow-rollout-roadmap.md。
 * 通过 {@code ont_metric.formula_sql} + 占位符 (:tenantId/:conceptCode/:objectId) 渲染为可执行 SQL。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "ont_metric")
public class MetricEntity {

    @Id
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "metric_code", nullable = false, length = 128)
    private String metricCode;

    @Column(name = "concept_code", nullable = false, length = 64)
    private String conceptCode;

    @Column(name = "display_name", nullable = false, length = 256)
    private String displayName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "formula_sql", nullable = false, columnDefinition = "TEXT")
    private String formulaSql;

    @Column(name = "return_type", nullable = false, length = 32)
    private String returnType;

    @Column(length = 32)
    private String unit;

    @Column(columnDefinition = "TEXT")
    private String dimensions;

    @Column(nullable = false, length = 16)
    private String aggregation;

    @Column(name = "cache_ttl_sec", nullable = false)
    private int cacheTtlSec;

    @Column(nullable = false)
    private boolean enabled;

    @Column(nullable = false)
    private int version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public enum ReturnType { DECIMAL, INT, BOOLEAN, JSON }
    public enum Aggregation { SUM, AVG, COUNT, MIN, MAX }
}
