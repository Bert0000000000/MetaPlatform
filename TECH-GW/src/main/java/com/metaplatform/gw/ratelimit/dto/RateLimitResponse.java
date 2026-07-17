package com.metaplatform.gw.ratelimit.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RateLimitResponse {

    private String ruleId;
    private String ruleName;
    private String description;
    private String routeId;
    private String routeName;
    private String scope;
    private String limitType;
    private Integer qpsLimit;
    private Integer concurrentLimit;
    private Long tokenLimit;
    private String tokenWindow;
    private Double burstFactor;
    private Integer quotaAlertThreshold;
    private String status;
    private Integer version;
    private CurrentStats currentStats;
    private LocalDateTime createdAt;
    private String createdBy;
    private LocalDateTime updatedAt;
    private String updatedBy;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CurrentStats {
        private Long currentQps;
        private Long maxQps;
        private Long triggeredCount;
        private LocalDateTime lastTriggeredAt;
        private Long totalRequests;
        private Long blockedRequests;
    }
}
