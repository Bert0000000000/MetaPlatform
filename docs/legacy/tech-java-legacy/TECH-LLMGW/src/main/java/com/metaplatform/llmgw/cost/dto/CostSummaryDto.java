package com.metaplatform.llmgw.cost.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CostSummaryDto(
        LocalDate startDate,
        LocalDate endDate,
        Long totalInputTokens,
        Long totalOutputTokens,
        BigDecimal totalCost,
        String currency,
        Long recordCount
) {
}
