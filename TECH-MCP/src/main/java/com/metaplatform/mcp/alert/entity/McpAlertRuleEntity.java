package com.metaplatform.mcp.alert.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "mcp_alert_rule")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class McpAlertRuleEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(nullable = false, length = 128)
    private String name;

    @Column(nullable = false, length = 64)
    private String metric;

    @Column(nullable = false, precision = 10, scale = 4)
    private java.math.BigDecimal threshold;

    @Column(name = "window_minutes", nullable = false)
    private Integer windowMinutes;

    @Column(nullable = false)
    private Boolean enabled;

    @Column(name = "notify_channels", columnDefinition = "TEXT")
    private String notifyChannels;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
