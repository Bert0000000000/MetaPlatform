package com.metaplatform.gw.audit.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "gw_audit_alert_rule")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GwAuditAlertRuleEntity {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "tenant_id", length = 64)
    private String tenantId;

    @Column(name = "name", length = 256, nullable = false)
    private String name;

    @Column(name = "condition_type", length = 32, nullable = false)
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

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;
}
