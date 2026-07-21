package com.metaplatform.mcp.debug.entity;

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
@Table(name = "mcp_debug_session")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class McpDebugSessionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "server_id")
    private UUID serverId;

    @Column(name = "tool_id")
    private UUID toolId;

    @Column(name = "method", length = 128)
    private String method;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "request_payload", columnDefinition = "jsonb")
    private String requestPayload;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "response_payload", columnDefinition = "jsonb")
    private String responsePayload;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "raw_request", columnDefinition = "TEXT")
    private String rawRequest;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "raw_response", columnDefinition = "TEXT")
    private String rawResponse;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "breakpoint", nullable = false)
    private Boolean breakpoint;

    @Column(name = "trace_id", nullable = false, length = 64)
    private String traceId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
