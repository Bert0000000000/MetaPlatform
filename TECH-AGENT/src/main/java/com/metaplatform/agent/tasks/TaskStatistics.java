package com.metaplatform.agent.tasks;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 任务统计信息。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskStatistics {

    private int total;
    private int completed;
    private int failed;
    private int running;
    private int pending;
    private double avgDurationMs;
}
