package com.metaplatform.agent.middleware;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/**
 * P5.7 ActionRouteDlqEntity - persistent DLQ row.
 *
 * <p>Mirror of the in-memory {@code FailedRoute} record, but backed by Postgres
 * so the queue survives restarts and can be queried / retried asynchronously.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "action_route_dlq")
public class ActionRouteDlqEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "run_id", nullable = false, length = 64)
    private String runId;

    @Column(name = "proposal_id", nullable = false, length = 64)
    private String proposalId;

    @Column(name = "action_code", nullable = false, length = 128)
    private String actionCode;

    @Column(name = "risk_level", nullable = false, length = 16)
    private String riskLevel;

    @Column(name = "reason", nullable = false, columnDefinition = "TEXT")
    private String reason;

    @Column(name = "failed_at", nullable = false)
    private Instant failedAt;

    @Column(name = "retry_count", nullable = false)
    private Integer retryCount;

    @Column(name = "last_retry_at")
    private Instant lastRetryAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(name = "resolved_status", length = 32)
    private String resolvedStatus;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
