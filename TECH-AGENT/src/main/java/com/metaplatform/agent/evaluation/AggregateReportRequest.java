package com.metaplatform.agent.evaluation;

import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 多员工协作报告聚合请求（V11-06）。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AggregateReportRequest {

    private String collaborationId;

    @NotEmpty
    private List<String> employeeIds;

    private String period;
}
