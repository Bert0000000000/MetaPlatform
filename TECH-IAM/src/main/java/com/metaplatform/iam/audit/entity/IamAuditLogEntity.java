package com.metaplatform.iam.audit.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;
import jakarta.persistence.EntityListeners;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "iam_audit_log")
@EntityListeners(AuditingEntityListener.class)
public class IamAuditLogEntity {

    @Id
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "user_id", length = 64)
    private String userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 64)
    private Action action;

    @Column(name = "resource_type", length = 64)
    private String resourceType;

    @Column(name = "resource_id", length = 128)
    private String resourceId;

    @Column(length = 1024)
    private String description;

    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    @Column(name = "user_agent", length = 512)
    private String userAgent;

    @Column(name = "trace_id", length = 64)
    private String traceId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Status status;

    @Column(columnDefinition = "TEXT")
    private String metadata;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public enum Action {
        CREATE,
        READ,
        UPDATE,
        DELETE,
        LOGIN,
        LOGOUT,
        REGISTER,
        PASSWORD_CHANGE,
        PERMISSION_GRANT,
        PERMISSION_REVOKE,
        ROLE_ASSIGN,
        ROLE_UNASSIGN,
        API_KEY_CREATE,
        API_KEY_REVOKE,
        SSO_LOGIN,
        MFA_ENABLE,
        MFA_DISABLE,
        USER_CREATE,
        USER_UPDATE,
        USER_DELETE,
        DEPARTMENT_CREATE,
        DEPARTMENT_UPDATE,
        DEPARTMENT_DELETE
    }

    public enum Status {
        SUCCESS,
        FAILURE,
        FAILED,
        PENDING
    }
}