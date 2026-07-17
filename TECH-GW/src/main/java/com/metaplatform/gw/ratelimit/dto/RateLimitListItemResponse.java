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
public class RateLimitListItemResponse {

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
    private String status;
    private Long currentQps;
    private Long currentConcurrent;
    private Long triggeredCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
