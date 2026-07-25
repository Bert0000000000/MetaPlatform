package com.metaplatform.data.monitoring.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

/**
 * SLA 响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SlaResponse {

    private String component;
    private double uptime;
    private double targetUptime;
    private boolean meetsTarget;
    private long totalRequests;
    private long failedRequests;
    private double errorRate;
    private double p99LatencyMs;
    private double avgLatencyMs;
    private Map<String, Object> details;
}
