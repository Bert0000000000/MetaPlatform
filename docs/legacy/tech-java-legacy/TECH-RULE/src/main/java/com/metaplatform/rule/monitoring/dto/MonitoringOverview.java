package com.metaplatform.rule.monitoring.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MonitoringOverview {

    private long totalExecutions;
    private long matchedExecutions;
    private long errorExecutions;
    private double matchRate;
    private double errorRate;
    private double avgExecutionTimeMs;
}
