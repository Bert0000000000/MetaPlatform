package com.metaplatform.rule.monitoring.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;
import java.time.Instant;

@Entity
@Table(name = "rule_execution_log")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExecutionLogEntity {

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "rule_id", length = 64)
    private String ruleId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "ruleset_id", length = 64)
    private String rulesetId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "input", columnDefinition = "jsonb")
    private Map<String, Object> input;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "output", columnDefinition = "jsonb")
    private Map<String, Object> output;

    @Column(name = "matched")
    private Boolean matched;

    @Column(name = "execution_time_ms")
    private Long executionTimeMs;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "trace_id", length = 128)
    private String traceId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

}
