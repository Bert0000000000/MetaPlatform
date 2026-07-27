package com.metaplatform.data.quality.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * 质量问题响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QualityIssueResponse {

    private String issueId;
    private String ruleId;
    private String targetAssetId;
    private String severity;
    private String description;
    private long failedRows;
    private double failureRate;
    private String status;
    private OffsetDateTime detectedAt;
}
