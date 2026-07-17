package com.metaplatform.gw.ratelimit.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "gw_rate_limit_rule")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GwRateLimitRuleEntity {

    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "tenant_id", length = 64, nullable = false)
    private String tenantId;

    @Column(name = "rule_id", length = 64, nullable = false)
    private String ruleId;

    @Column(name = "rule_name", length = 128, nullable = false)
    private String ruleName;

    @Column(name = "description", length = 1024)
    private String description;

    @Column(name = "route_id", length = 64)
    private String routeId;

    @Column(name = "scope", length = 16, nullable = false)
    private String scope;

    @Column(name = "limit_type", length = 16, nullable = false)
    private String limitType;

    @Column(name = "qps_limit")
    private Integer qpsLimit;

    @Column(name = "concurrent_limit")
    private Integer concurrentLimit;

    @Column(name = "token_limit")
    private Long tokenLimit;

    @Column(name = "token_window", length = 16)
    private String tokenWindow;

    @Column(name = "burst_factor", precision = 3, scale = 1)
    private BigDecimal burstFactor;

    @Column(name = "quota_alert_threshold")
    private Integer quotaAlertThreshold;

    @Column(name = "status", length = 16, nullable = false)
    private String status;

    @Column(name = "version", nullable = false)
    private Integer version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "created_by", length = 64, nullable = false, updatable = false)
    private String createdBy;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "updated_by", length = 64, nullable = false)
    private String updatedBy;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;
}
