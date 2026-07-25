package com.metaplatform.llmgw.cost.dto;

import java.math.BigDecimal;

public record CostByUserDto(
        String userId,
        Long totalInputTokens,
        Long totalOutputTokens,
        BigDecimal totalCost,
        String currency,
        Long recordCount
) {
}
