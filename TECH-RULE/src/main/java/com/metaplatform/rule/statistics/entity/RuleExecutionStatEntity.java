package com.metaplatform.rule.statistics.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "rule_execution_stat",
        uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "target_type", "target_id", "execution_date"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RuleExecutionStatEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "target_type", nullable = false, length = 32)
    private String targetType;

    @Column(name = "target_id", nullable = false, length = 64)
    private String targetId;

    @Column(name = "execution_date", nullable = false)
    private LocalDate executionDate;

    @Column(name = "total_count", nullable = false)
    @Builder.Default
    private Integer totalCount = 0;

    @Column(name = "hit_count", nullable = false)
    @Builder.Default
    private Integer hitCount = 0;

    @Column(name = "miss_count", nullable = false)
    @Builder.Default
    private Integer missCount = 0;

    @Column(name = "error_count", nullable = false)
    @Builder.Default
    private Integer errorCount = 0;

    @Column(name = "avg_duration_ms")
    private Long avgDurationMs;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
