package com.metaplatform.action.orchestration.entity;

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
@Table(name = "action_orchestration_execution")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrchestrationExecutionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "execution_id", nullable = false, length = 64)
    private String executionId;

    @Column(name = "orchestration_id", nullable = false, length = 64)
    private String orchestrationId;

    @Column(nullable = false, length = 20)
    private String status;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "node_states", columnDefinition = "jsonb", nullable = false)
    private String nodeStates;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(columnDefinition = "jsonb")
    private String input;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(columnDefinition = "jsonb")
    private String output;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "compensation_actions", columnDefinition = "jsonb")
    private String compensationActions;

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
