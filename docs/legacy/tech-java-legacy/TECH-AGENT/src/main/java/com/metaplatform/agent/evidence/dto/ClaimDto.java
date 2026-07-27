package com.metaplatform.agent.evidence.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ClaimDto {
    private String claimId;
    private String runId;
    private String taskId;
    private String type;
    private String content;
    private BigDecimal confidence;
    private List<String> evidenceRefs;
    private Map<String, String> generatedBy;
    private Instant createdAt;
    private List<String> toolCallIds;
    private String promptSnapshotId;
}
