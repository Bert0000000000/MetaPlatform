package com.metaplatform.mcp.collaboration.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "mcp_collaboration_audit")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CollaborationAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "caller_id", nullable = false, length = 256)
    private String callerId;

    @Column(name = "caller_type", nullable = false, length = 20)
    private String callerType;

    @Column(name = "callee_id", nullable = false, length = 256)
    private String calleeId;

    @Column(name = "callee_type", nullable = false, length = 20)
    private String calleeType;

    @Column(length = 256)
    private String operation;

    @Column(name = "protocol_type", nullable = false, length = 20)
    private String protocolType;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "duration_ms", nullable = false)
    private Long durationMs;

    @Column(name = "request_payload", columnDefinition = "TEXT")
    private String requestPayload;

    @Column(name = "response_payload", columnDefinition = "TEXT")
    private String responsePayload;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "trace_id", length = 64)
    private String traceId;

    @Column(name = "called_at", nullable = false)
    private Instant calledAt;
}
