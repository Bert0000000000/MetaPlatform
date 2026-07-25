package com.metaplatform.llmgw.cost.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record CostRecordDto(
        Long id,
        String traceId,
        String userId,
        String appId,
        String modelId,
        String provider,
        Integer inputTokens,
        Integer outputTokens,
        BigDecimal inputCost,
        BigDecimal outputCost,
        BigDecimal totalCost,
        String currency,
        LocalDate billingDate,
        LocalDateTime createdAt
) {
}
