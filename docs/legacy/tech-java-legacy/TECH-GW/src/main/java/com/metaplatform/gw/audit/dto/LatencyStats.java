package com.metaplatform.gw.audit.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LatencyStats {
    private String path;
    private Long totalRequests;
    private Double avgDurationMs;
    private Long maxDurationMs;
    private Long errorCount;
    private Double errorRate;

    public Double getErrorRate() {
        if (errorRate != null) return errorRate;
        if (totalRequests == null || totalRequests == 0) return 0.0;
        return (errorCount == null ? 0 : errorCount.doubleValue()) / totalRequests.doubleValue();
    }
}
