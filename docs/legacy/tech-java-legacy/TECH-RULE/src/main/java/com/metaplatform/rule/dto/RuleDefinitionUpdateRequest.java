package com.metaplatform.rule.dto;

import com.metaplatform.rule.entity.ActionType;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Map;

@Data
public class RuleDefinitionUpdateRequest {

    @Size(max = 128)
    private String name;

    private String description;

    private String conditionExpr;

    private ActionType actionType;

    private Map<String, Object> actionConfig;

    private Integer priority;

    private Boolean enabled;
}
