package com.metaplatform.a2a.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

@Entity
@Table(name = "delegated_task")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DelegatedTaskEntity {

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "source_agent_id", nullable = false, length = 128)
    private String sourceAgentId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "target_agent_id", nullable = false, length = 128)
    private String targetAgentId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "task_type", nullable = false, length = 64)
    private String taskType;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "payload", nullable = false, columnDefinition = "jsonb")
    private String payload;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "result", columnDefinition = "jsonb")
    private String result;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "error", length = 2048)
    private String error;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "trace_id", length = 64)
    private String traceId;

    @Column(name = "timeout")
    private Double timeout;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "callback_url", length = 1024)
    private String callbackUrl;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "status_history", nullable = false, columnDefinition = "jsonb")
    private String statusHistory;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "artifacts", nullable = false, columnDefinition = "jsonb")
    private String artifacts;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

}
