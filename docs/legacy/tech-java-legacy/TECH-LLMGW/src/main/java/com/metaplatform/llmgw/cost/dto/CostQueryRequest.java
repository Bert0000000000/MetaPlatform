package com.metaplatform.llmgw.cost.dto;

import java.time.LocalDate;

public record CostQueryRequest(
        String userId,
        String modelId,
        String provider,
        LocalDate startDate,
        LocalDate endDate,
        Integer page,
        Integer size
) {
}
