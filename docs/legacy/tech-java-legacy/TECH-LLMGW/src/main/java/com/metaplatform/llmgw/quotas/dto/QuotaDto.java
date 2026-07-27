package com.metaplatform.llmgw.quotas.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record QuotaDto(
        Long id,
        String scope,
        String scopeKey,
        String modelId,
        Long dailyTokenLimit,
        Long monthlyTokenLimit,
        Integer dailyRequestLimit,
        Integer monthlyRequestLimit,
        LocalDate periodStart,
        Boolean isActive,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
