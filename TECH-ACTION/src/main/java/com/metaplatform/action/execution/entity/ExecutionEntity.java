package com.metaplatform.action.execution.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
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
    private String tenantId;

    @Column(name = "execution_id", nullable = false, length = 64, unique = true)
    private String executionId;

    @Column(name = "action_id", nullable = false, length = 64)
    private String actionId;

    @Column(name = "action_code", nullable = false, length = 128)
    private String actionCode;

    @Column(nullable = false, length = 20)
    private String status;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(columnDefinition = "jsonb", nullable = false)
    private String input;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(columnDefinition = "jsonb")
    private String output;

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

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
