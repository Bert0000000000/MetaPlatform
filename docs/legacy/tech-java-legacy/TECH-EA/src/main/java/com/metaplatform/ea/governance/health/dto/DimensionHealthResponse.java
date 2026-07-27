package com.metaplatform.ea.governance.health.dto;

import lombok.Builder;

import java.util.List;
import java.util.Map;

@Builder
public record DimensionHealthResponse(
        String dimension,
        double score,
        Map<String, Object> metrics,
        List<String> improvementSuggestions
) {
}
