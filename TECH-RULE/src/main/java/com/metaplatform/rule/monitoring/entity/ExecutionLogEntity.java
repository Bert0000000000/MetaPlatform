package com.metaplatform.rule.monitoring.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "rule_execution_log")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExecutionLogEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "rule_id", length = 64)
    private String ruleId;

    @Column(name = "ruleset_id", length = 64)
    private String rulesetId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "input", columnDefinition = "jsonb")
    private String input;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "output", columnDefinition = "jsonb")
    private String output;

    @Column(name = "matched")
    private Boolean matched;

    @Column(name = "execution_time_ms")
    private Long executionTimeMs;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "trace_id", length = 128)
    private String traceId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
