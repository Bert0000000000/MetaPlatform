package com.metaplatform.agent.evaluation;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 多员工协作报告聚合响应（V11-06）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AggregateReportResponse {

    private String collaborationId;
    private List<String> employeeIds;
    private int totalEmployees;
    private int totalConversations;
    private double avgQualityScore;
    private double successRate;
    private List<AutoScoreResult.DimensionScore> dimensions;
    private List<String> highlights;
    private List<String> issues;
    private String report;
    private OffsetDateTime generatedAt;
}
