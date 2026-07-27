package com.metaplatform.action.statistics.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StatsOverview {

    private long totalExecutions;
    private long successfulExecutions;
    private long failedExecutions;
    private double successRate;
    private long avgDurationMs;
}
