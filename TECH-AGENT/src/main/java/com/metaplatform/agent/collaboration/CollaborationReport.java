package com.metaplatform.agent.collaboration;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 协作任务完成后的聚合报告（V15-04）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CollaborationReport {

    private String collaborationId;
    private String title;
    private String goal;
    private String status;
    private int totalDurationSeconds;
    private int totalSubtasks;
    private int completedSubtasks;
    private int failedSubtasks;
    private int sequentialDurationSeconds;
    private int parallelDurationSeconds;
    private double efficiencyImprovementPct;
    private List<Contribution> contributions;
    private String finalReport;
}
