package com.metaplatform.data.quality.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * 质量概览响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QualityOverviewResponse {

    private int totalRules;
    private int activeRules;
    private long totalChecks;
    private long passedChecks;
    private long failedChecks;
    private double overallPassRate;
    private Map<String, Double> dimensionScores;
    private List<DimensionScore> dimensions;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DimensionScore {
        private String dimension;
        private double score;
        private String status;
        private OffsetDateTime lastChecked;
    }
}
