package com.metaplatform.gw.audit.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogStatistics {
    private List<LatencyStats> perPath;
    private Long totalRequests;
    private Long totalErrors;
    private Double overallErrorRate;
    private String windowStart;
    private String windowEnd;
}
