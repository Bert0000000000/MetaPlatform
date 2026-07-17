package com.metaplatform.action.orchestration.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrchestrationResponse {

    private String orchestrationId;
    private String code;
    private String name;
    private String description;
    private String nodes;
    private String edges;
    private String ruleIntegration;
    private String status;
    private Integer version;
    private String createdBy;
    private String updatedBy;
    private Instant createdAt;
    private Instant updatedAt;
}
