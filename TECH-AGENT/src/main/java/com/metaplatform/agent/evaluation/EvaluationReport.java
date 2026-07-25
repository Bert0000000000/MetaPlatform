package com.metaplatform.agent.evaluation;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 评估报告（基础）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class EvaluationReport {

    private String reportId;
    private String employeeId;
    private String period;
    private int totalTasks;
    private double avgQualityScore;
    private double successRate;
    private double avgDuration;
    private List<String> highlights;
    private List<String> issues;
    private OffsetDateTime createdAt;
}
