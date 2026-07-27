package com.metaplatform.action.statistics.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExecutionHistoryItem {

    private String executionId;
    private String actionId;
    private String actionName;
    private String status;
    private Integer durationMs;
    private Instant startedAt;
    private String errorMessage;
}
