package com.metaplatform.gw.audit.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;
import java.util.UUID;
import java.time.Instant;

@Entity
@Table(name = "gw_audit_alert_rule")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GwAuditAlertRuleEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "name", nullable = false, length = 256)
    private String name;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "condition_type", nullable = false, length = 32)
    private String conditionType;

    @Column(name = "threshold_ms")
    private Long thresholdMs;

    @Column(name = "threshold_error_rate")
    private Double thresholdErrorRate;

    @Column(name = "threshold_rps")
    private Long thresholdRps;

    @Column(name = "enabled")
    private Boolean enabled;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "notification_config", columnDefinition = "jsonb")
    private Map<String, Object> notificationConfig;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

}
