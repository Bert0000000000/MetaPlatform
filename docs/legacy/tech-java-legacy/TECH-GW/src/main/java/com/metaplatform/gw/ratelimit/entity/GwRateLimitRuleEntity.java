package com.metaplatform.gw.ratelimit.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.math.BigDecimal;

@Entity
@Table(name = "gw_rate_limit_rule")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GwRateLimitRuleEntity {

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "rule_id", nullable = false, length = 64)
    private String ruleId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "rule_name", nullable = false, length = 128)
    private String ruleName;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "description", length = 1024)
    private String description;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "route_id", length = 64)
    private String routeId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "scope", nullable = false, length = 16)
    private String scope;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "limit_type", nullable = false, length = 16)
    private String limitType;

    @Column(name = "qps_limit")
    private Integer qpsLimit;

    @Column(name = "concurrent_limit")
    private Integer concurrentLimit;

    @Column(name = "token_limit")
    private Long tokenLimit;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "token_window", length = 16)
    private String tokenWindow;

    @Column(name = "burst_factor")
    private BigDecimal burstFactor;

    @Column(name = "quota_alert_threshold")
    private Integer quotaAlertThreshold;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 16)
    private String status;

    @Column(name = "version", nullable = false)
    private Integer version;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "created_by", nullable = false, length = 64)
    private String createdBy;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "updated_by", nullable = false, length = 64)
    private String updatedBy;

    @Column(name = "deleted_at")
    private Instant deletedAt;

}
