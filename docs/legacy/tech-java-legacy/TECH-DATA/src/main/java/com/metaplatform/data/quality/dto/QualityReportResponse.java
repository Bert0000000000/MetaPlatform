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
 * 质量报告响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QualityReportResponse {

    private String reportId;
    private String tenantId;
    private String targetAssetId;
    private OffsetDateTime generatedAt;
    private double overallScore;
    private Map<String, Double> dimensionScores;
    private List<QualityIssueResponse> issues;
    private List<QualityCheckResultResponse> checks;
}
