package com.metaplatform.ea.governance.health.dto;

import lombok.Builder;

import java.time.LocalDate;

@Builder
public record TrendPoint(
        LocalDate date,
        double score,
        String dimension
) {
}
