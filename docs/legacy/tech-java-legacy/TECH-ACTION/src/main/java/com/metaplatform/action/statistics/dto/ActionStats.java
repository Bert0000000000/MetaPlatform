package com.metaplatform.action.statistics.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ActionStats {

    private String actionId;
    private String actionName;
    private long totalExecutions;
    private double successRate;
    private long avgDurationMs;
    private Instant lastExecutedAt;
}
