package com.metaplatform.rule.statistics.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StatisticsOverview {
    private long totalExecutions;
    private long hitExecutions;
    private long missExecutions;
    private long errorExecutions;
    private double hitRate;
    private double errorRate;
    private long avgDurationMs;
    private int targetCount;
}
