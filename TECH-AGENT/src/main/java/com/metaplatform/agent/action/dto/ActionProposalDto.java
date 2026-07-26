package com.metaplatform.agent.action.dto;

import lombok.*;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ActionProposalDto {
    private String proposalId;
    private String runId;
    private String taskId;
    private String actionCode;
    private List<String> targetObjects;
    private Map<String, Object> parameters;
    private String reason;
    private List<String> evidenceRefs;
    private String riskLevel;
    private boolean approvalRequired;
    private String idempotencyKey;
    private String status;
    private String decidedBy;
    private Instant decisionAt;
    private String decisionReason;
    private Instant proposedAt;
    private Instant expiresAt;
}
