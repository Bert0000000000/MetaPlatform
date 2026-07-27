package com.metaplatform.llmgw.cost.dto;

import java.math.BigDecimal;

public record CostByModelDto(
        String modelId,
        Long totalInputTokens,
        Long totalOutputTokens,
        BigDecimal totalCost,
        String currency,
        Long recordCount
) {
}
