package com.metaplatform.agent.runs.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CreateAgentRunRequest {
    @NotBlank private String agentId;
    @NotBlank @Size(max=4096) private String goal;
    @NotBlank private String envelopeId;
    private String runtimeType;
    private String parentRunId;
    @Valid private BudgetDto budget;
}
