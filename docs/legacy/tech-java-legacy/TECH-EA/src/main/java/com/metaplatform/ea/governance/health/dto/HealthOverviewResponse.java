package com.metaplatform.ea.governance.health.dto;

import lombok.Builder;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Builder
public record HealthOverviewResponse(
        double overallScore,
        Map<String, Double> dimensionScores,
        List<TrendPoint> recentTrend,
        List<RiskItemResponse> keyRisks,
        LocalDate assessedDate
) {
}
