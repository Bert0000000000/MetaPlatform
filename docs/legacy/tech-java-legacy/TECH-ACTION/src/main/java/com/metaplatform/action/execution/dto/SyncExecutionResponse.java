package com.metaplatform.action.execution.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyncExecutionResponse {

    private String executionId;
    private String actionId;
    private String actionCode;
    private String status;
    private Object input;
    private Object output;
    private String errorMessage;
    private Instant startedAt;
    private Instant completedAt;
    private Integer durationMs;
}
