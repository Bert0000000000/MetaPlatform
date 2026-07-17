package com.metaplatform.mcp.audit.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogStatistics {

    private long totalCalls;
    private double successRate;
    private double avgDuration;
    private long totalInputTokens;
    private long totalOutputTokens;
    private Map<String, Long> byStatus;
    private Map<String, Long> byTool;
}