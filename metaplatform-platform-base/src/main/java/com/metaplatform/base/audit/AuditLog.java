package com.metaplatform.base.audit;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "audit_logs")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String action; // CREATE, UPDATE, DELETE, READ

    @Column(name = "resource_type", nullable = false)
    private String resourceType; // e.g., "object-type", "object-instance"

    @Column(name = "resource_id", nullable = false)
    private String resourceId;

    @Column(columnDefinition = "jsonb")
    private String details; // JSON 格式的变更详情

    @Column(nullable = false, updatable = false)
    private Instant timestamp;

    @Column(name = "ip_address")
    private String ipAddress;

    @Column(name = "user_agent")
    private String userAgent;

    protected AuditLog() {} // JPA

    public AuditLog(UUID tenantId, UUID userId, String action, String resourceType,
                    String resourceId, String details, String ipAddress, String userAgent) {
        this.tenantId = tenantId;
        this.userId = userId;
        this.action = action;
        this.resourceType = resourceType;
        this.resourceId = resourceId;
        this.details = details;
        this.ipAddress = ipAddress;
        this.userAgent = userAgent;
        this.timestamp = Instant.now();
    }

    // Getters
    public Long getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public UUID getUserId() { return userId; }
    public String getAction() { return action; }
    public String getResourceType() { return resourceType; }
    public String getResourceId() { return resourceId; }
    public String getDetails() { return details; }
    public Instant getTimestamp() { return timestamp; }
    public String getIpAddress() { return ipAddress; }
    public String getUserAgent() { return userAgent; }
}
