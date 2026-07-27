package com.metaplatform.llmgw.ratelimits.dto;

public record RateLimitStatsDto(
        Long ruleId,
        String name,
        Integer rpm,
        Long currentRpm,
        Boolean limited
) {
}
