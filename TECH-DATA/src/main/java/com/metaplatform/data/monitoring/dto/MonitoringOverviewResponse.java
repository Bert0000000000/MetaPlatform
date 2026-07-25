package com.metaplatform.data.monitoring.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * 监控概览响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MonitoringOverviewResponse {

    private int activeAlerts;
    private int criticalAlerts;
    private int warningAlerts;
    private int infoAlerts;
    private double overallHealth;
    private Map<String, Double> componentHealth;
    private OffsetDateTime generatedAt;
}
