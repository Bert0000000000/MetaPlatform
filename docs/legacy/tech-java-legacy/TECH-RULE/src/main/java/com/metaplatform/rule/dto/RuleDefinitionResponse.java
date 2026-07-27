package com.metaplatform.rule.dto;

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
public class RuleDefinitionResponse {

    private String id;
    private String tenantId;
    private String rulesetId;
    private String code;
    private String name;
    private String description;
    private String conditionExpr;
    private String actionType;
    private Map<String, Object> actionConfig;
    private Integer priority;
    private Boolean enabled;
    private Instant createdAt;
    private Instant updatedAt;
    private String createdBy;
    private String updatedBy;
}
