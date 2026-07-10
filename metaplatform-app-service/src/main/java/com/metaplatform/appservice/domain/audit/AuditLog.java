package com.metaplatform.appservice.domain.audit;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * 审计日志（横切）。
 *
 * <p>Sprint 0 期间通过 {@link AuditInterceptor} 自动写入；
 * Sprint 1 起移到 AOP 切面，避免每条路由手工埋点。
 */
@Entity
@Table(name = "app_audit_logs")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "resource_type", nullable = false, length = 32)
    private String resourceType;

    @Column(name = "resource_id")
    private Long resourceId;

    @Column(nullable = false, length = 32)
    private String action;

    @Column(nullable = false, length = 64)
    private String actor;

    @Column(length = 64)
    private String tenantId;

    @Column(columnDefinition = "TEXT")
    private String payload;

    @Column(name = "trace_id", length = 64)
    private String traceId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public AuditLog() {}

    public AuditLog(String resourceType, Long resourceId, String action,
                    String actor, String tenantId, String payload, String traceId) {
        this.resourceType = resourceType;
        this.resourceId = resourceId;
        this.action = action;
        this.actor = actor;
        this.tenantId = tenantId;
        this.payload = payload;
        this.traceId = traceId;
    }

    public Long getId() { return id; }
    public String getResourceType() { return resourceType; }
    public Long getResourceId() { return resourceId; }
    public String getAction() { return action; }
    public String getActor() { return actor; }
    public String getTenantId() { return tenantId; }
    public String getPayload() { return payload; }
    public String getTraceId() { return traceId; }
    public Instant getCreatedAt() { return createdAt; }
}
