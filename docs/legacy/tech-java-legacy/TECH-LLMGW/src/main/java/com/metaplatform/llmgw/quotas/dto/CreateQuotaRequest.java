package com.metaplatform.llmgw.quotas.dto;

import java.time.LocalDate;

public record CreateQuotaRequest(
        String scope,
        String scopeKey,
        String modelId,
        Long dailyTokenLimit,
        Long monthlyTokenLimit,
        Integer dailyRequestLimit,
        Integer monthlyRequestLimit,
        LocalDate periodStart,
        Boolean isActive
) {
}
