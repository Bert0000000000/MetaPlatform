package com.metaplatform.dashboard.dto;

public record DeliverableStatsResponse(
        long total,
        long active,
        long archived,
        long shared
) {
}
