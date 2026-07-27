package com.metaplatform.llmgw.ratelimits.dto;

public record CreateRateLimitRuleRequest(
        String name,
        String scope,
        String scopeKey,
        String modelId,
        Integer rpm,
        Integer tpm,
        Integer concurrent,
        Boolean isActive
) {
}
