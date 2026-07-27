package com.metaplatform.gw.ratelimit.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RateLimitRuleStatsResponse {

    private String ruleId;
    private String ruleName;
    private String limitType;
    private Integer qpsLimit;
    private Integer concurrentLimit;
    private Long tokenLimit;
    private Long currentQps;
    private Long currentConcurrent;
    private Summary summary;
    private List<TimelinePoint> timeline;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Summary {
        private Long totalRequests;
        private Long blockedRequests;
        private Double blockedRate;
        private Long maxQps;
        private Long avgQps;
        private Long triggeredCount;
        private Instant lastTriggeredAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TimelinePoint {
        private Instant timestamp;
        private Long totalRequests;
        private Long blockedRequests;
        private Long maxQps;
        private Long avgQps;
    }
}
