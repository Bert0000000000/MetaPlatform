package com.metaplatform.rule.monitoring.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExecutionHistoryItem {

    private String id;
    private String ruleId;
    private String rulesetId;
    private Boolean matched;
    private Long executionTimeMs;
    private String errorMessage;
    private String traceId;
    private Instant createdAt;
    private Map<String, Object> input;
    private Map<String, Object> output;
}
