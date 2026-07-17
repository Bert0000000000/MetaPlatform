package com.metaplatform.gw.ratelimit.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RateLimitStatsResponse {

    private Summary summary;
    private List<ByRule> byRule;
    private List<TimelinePoint> timeline;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Summary {
        private Long totalRequests;
        private Long blockedRequests;
        private Double blockedRate;
        private Integer triggeredRules;
        private Integer activeRules;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ByRule {
        private String ruleId;
        private String ruleName;
        private Long totalRequests;
        private Long blockedRequests;
        private Double blockedRate;
        private Long maxQps;
        private Long avgQps;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TimelinePoint {
        private LocalDateTime timestamp;
        private Long totalRequests;
        private Long blockedRequests;
        private Long avgQps;
    }
}
