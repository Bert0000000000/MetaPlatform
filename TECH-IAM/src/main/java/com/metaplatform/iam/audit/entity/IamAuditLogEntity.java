package com.metaplatform.iam.audit.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "iam_audit_log")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IamAuditLogEntity {

    public enum Action { CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT, LOGIN_FAILED, PASSWORD_CHANGE, PASSWORD_RESET,
        USER_CREATE, USER_UPDATE, USER_DELETE, USER_DISABLE, USER_ENABLE,
        ROLE_CREATE, ROLE_UPDATE, ROLE_DELETE, ROLE_ASSIGN,
        PERMISSION_CREATE, PERMISSION_UPDATE, PERMISSION_DELETE, PERMISSION_GRANT, PERMISSION_REVOKE,
        POLICY_CREATE, POLICY_UPDATE, POLICY_DELETE,
        DEPARTMENT_CREATE, DEPARTMENT_UPDATE, DEPARTMENT_DELETE,
        APIKEY_CREATE, APIKEY_REVOKE,
        MFA_ENABLE, MFA_DISABLE,
        SSO_LOGIN, SSO_CONFIG_UPDATE,
        DATA_PERMISSION_UPDATE,
        EXPORT, IMPORT, OTHER }

    public enum Status { SUCCESS, FAILURE, FAILED, PARTIAL }

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 255)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "user_id", length = 64)
    private String userId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 64)
    private Action action;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "resource_type", length = 64)
    private String resourceType;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "resource_id", length = 128)
    private String resourceId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "description", length = 1024)
    private String description;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "user_agent", length = 512)
    private String userAgent;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "trace_id", length = 64)
    private String traceId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private Status status;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "TEXT")
    private Map<String, Object> metadata;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

}
