package com.metaplatform.rule.monitoring.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RuleStats {

    private String ruleId;
    private long totalExecutions;
    private long matchedExecutions;
    private long errorExecutions;
    private double matchRate;
    private double avgExecutionTimeMs;
}
