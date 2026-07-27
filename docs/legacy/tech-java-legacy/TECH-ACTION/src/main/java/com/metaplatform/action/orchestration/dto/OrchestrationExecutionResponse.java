package com.metaplatform.action.orchestration.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrchestrationExecutionResponse {

    private String executionId;
    private String orchestrationId;
    private String status;
    private List<NodeStateDto> nodeStates;
    private Object input;
    private Object output;
    private String errorMessage;
    private String traceId;
    private Instant startedAt;
    private Instant completedAt;
    private Integer durationMs;
    private List<NodeStateDto> compensationActions;
}
