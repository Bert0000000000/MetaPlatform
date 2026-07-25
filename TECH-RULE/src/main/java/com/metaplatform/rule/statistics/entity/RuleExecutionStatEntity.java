package com.metaplatform.rule.statistics.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "rule_execution_stat")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RuleExecutionStatEntity {

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "target_type", nullable = false, length = 32)
    private String targetType;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "target_id", nullable = false, length = 64)
    private String targetId;

    @Column(name = "execution_date", nullable = false)
    private LocalDate executionDate;

    @Column(name = "total_count", nullable = false)
    private Integer totalCount;

    @Column(name = "hit_count", nullable = false)
    private Integer hitCount;

    @Column(name = "miss_count", nullable = false)
    private Integer missCount;

    @Column(name = "error_count", nullable = false)
    private Integer errorCount;

    @Column(name = "avg_duration_ms")
    private Long avgDurationMs;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

}
