package com.metaplatform.action.orchestration.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrchestrationResponse {

    private String orchestrationId;
    private String code;
    private String name;
    private String description;
    private Map<String, Object> nodes;
    private Map<String, Object> edges;
    private Map<String, Object> ruleIntegration;
    private String status;
    private Integer version;
    private String createdBy;
    private String updatedBy;
    private Instant createdAt;
    private Instant updatedAt;
}