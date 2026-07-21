package com.metaplatform.mcp.audit.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "mcp_audit_log")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class McpAuditLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "tool_id")
    private UUID toolId;

    @Column(name = "tool_code", length = 128)
    private String toolCode;

    @Column(name = "server_id")
    private UUID serverId;

    @Column(name = "client_id")
    private UUID clientId;

    @Column(name = "invocation_type", length = 32)
    private String invocationType;

    @Column(name = "input_tokens", nullable = false)
    private Integer inputTokens;

    @Column(name = "output_tokens", nullable = false)
    private Integer outputTokens;

    @Column(name = "duration_ms", nullable = false)
    private Long durationMs;

    @Column(nullable = false, length = 32)
    private String status;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "trace_id", length = 64)
    private String traceId;

    @Column(name = "user_id", length = 64)
    private String userId;

    @Column(name = "called_at", nullable = false)
    private Instant calledAt;
}