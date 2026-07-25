package com.metaplatform.ea.governance.health.dto;

import lombok.Builder;

import java.util.List;

@Builder
public record HealthTrendResponse(
        int days,
        List<TrendPoint> trends
) {
}
