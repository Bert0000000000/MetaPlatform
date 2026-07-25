package com.metaplatform.llmgw.ratelimits.dto;

import java.time.LocalDateTime;

public record RateLimitRuleDto(
        Long id,
        String name,
        String scope,
        String scopeKey,
        String modelId,
        Integer rpm,
        Integer tpm,
        Integer concurrent,
        Boolean isActive,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
