package com.metaplatform.agent.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

@Entity
@Table(name = "agent_tool_calls")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentToolCallEntity {

    @Id
    @Column(name = "id", length = 64, nullable = false)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String id;

    @Column(name = "tenant_id", length = 64, nullable = false)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String tenantId;

    @Column(name = "execution_id", length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String executionId;

    @Column(name = "step_id", length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String stepId;

    @Column(name = "tool_id", length = 64, nullable = false)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String toolId;

    @Column(name = "tool_name", length = 256, nullable = false)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String toolName;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "tool_input", columnDefinition = "TEXT")
    private String toolInput;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "tool_output", columnDefinition = "TEXT")
    private String toolOutput;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "result", columnDefinition = "TEXT")
    private String result;

    @Column(name = "status", length = 32, nullable = false)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String status;

    @Column(name = "duration_ms")
    private Integer durationMs;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "started_at", nullable = false)
    private OffsetDateTime startedAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
