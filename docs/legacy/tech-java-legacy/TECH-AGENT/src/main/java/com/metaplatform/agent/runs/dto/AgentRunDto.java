package com.metaplatform.agent.runs.dto;

import lombok.*;
import java.time.Instant;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class AgentRunDto {
    private String runId;
    private String tenantId;
    private String userId;
    private String agentId;
    private String runtimeType;
    private String contextEnvelopeId;
    private String status;
    private String goal;
    private BudgetDto budget;
    private String parentRunId;
    private String traceId;
    private String deerflowThreadId;
    private String deerflowRunId;
    private Instant startedAt;
    private Instant finishedAt;
    private String errorCode;
    private String errorMessage;
    private Instant createdAt;
    private Instant updatedAt;
}
