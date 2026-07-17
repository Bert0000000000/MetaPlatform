package com.metaplatform.gw.audit.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "gw_audit_log")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GwAuditLogEntity {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "tenant_id", length = 64)
    private String tenantId;

    @Column(name = "api_id")
    private UUID apiId;

    @Column(name = "path", length = 512)
    private String path;

    @Column(name = "method", length = 16)
    private String method;

    @Column(name = "status_code")
    private Integer statusCode;

    @Column(name = "request_size")
    private Long requestSize;

    @Column(name = "response_size")
    private Long responseSize;

    @Column(name = "duration_ms", nullable = false)
    private Long durationMs;

    @Column(name = "user_id", length = 64)
    private String userId;

    @Column(name = "trace_id", length = 64)
    private String traceId;

    @Column(name = "client_ip", length = 64)
    private String clientIp;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "is_error")
    private Boolean isError;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
