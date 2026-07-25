package com.metaplatform.action.execution.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "executions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExecutionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String tenantId;

    @Column(name = "execution_id", nullable = false, length = 64, unique = true)
    private String executionId;

    @Column(name = "action_id", nullable = false, length = 64)
    private String actionId;

    @Column(name = "action_code", nullable = false, length = 128)
    private String actionCode;

    @Column(nullable = false, length = 20)
    private String status;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> input;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> output;

    @Column(name = "error_code", length = 10)
    private String errorCode;

    @Column(name = "error_message")
    private String errorMessage;

    @Column(name = "trace_id", nullable = false, length = 64)
    private String traceId;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "duration_ms")
    private Integer durationMs;

    @Column(name = "aborted_at")
    private Instant abortedAt;

    @Column(name = "aborted_by", length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String abortedBy;

    @Column(name = "retry_of", length = 64)
    private String retryOf;

    @Column(name = "retry_count")
    private Integer retryCount;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}