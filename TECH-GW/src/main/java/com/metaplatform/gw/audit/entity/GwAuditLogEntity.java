package com.metaplatform.gw.audit.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.UUID;
import java.time.Instant;

@Entity
@Table(name = "gw_audit_log")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GwAuditLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", length = 64)
    private String tenantId;

    @Column(name = "api_id")
    private UUID apiId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "path", length = 512)
    private String path;

    @JdbcTypeCode(SqlTypes.VARCHAR)
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

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "user_id", length = 64)
    private String userId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "trace_id", length = 64)
    private String traceId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "client_ip", length = 64)
    private String clientIp;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "is_error")
    private Boolean isError;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

}
