package com.metaplatform.agent.action.dto;

import jakarta.validation.constraints.*;
import lombok.*;
import java.util.List;
import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ActionProposalCreateRequest {
    @NotBlank private String runId;
    private String taskId;
    @NotBlank private String actionCode;
    @NotEmpty private List<String> targetObjects;
    @NotNull private Map<String, Object> parameters;
    @NotBlank @Size(max=1024) private String reason;
    @NotEmpty private List<String> evidenceRefs;
    private String riskLevel;
}
