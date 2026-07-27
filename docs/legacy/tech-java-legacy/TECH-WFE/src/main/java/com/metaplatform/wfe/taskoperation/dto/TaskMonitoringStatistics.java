package com.metaplatform.wfe.taskoperation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskMonitoringStatistics {

    private long totalActive;
    private long totalCompleted;
    private long totalOverdue;
    private double avgProcessingMinutes;
    private long delegations;
    private long addSigns;
    private long urges;
}