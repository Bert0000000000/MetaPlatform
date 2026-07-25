package com.metaplatform.ea.governance.health.dto;

import lombok.Builder;

import java.time.Instant;

@Builder
public record RiskItemResponse(
        String dimension,
        String severity,
        String title,
        String description,
        String recommendation,
        Instant identifiedAt
) {
}
