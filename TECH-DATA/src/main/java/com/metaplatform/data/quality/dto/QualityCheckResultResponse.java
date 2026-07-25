package com.metaplatform.data.quality.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * 质量检查结果响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QualityCheckResultResponse {

    private String checkId;
    private String ruleId;
    private String targetAssetId;
    private String status;
    private long totalRows;
    private long passedRows;
    private long failedRows;
    private double passRate;
    private Map<String, Object> metrics;
    private OffsetDateTime checkedAt;
}
