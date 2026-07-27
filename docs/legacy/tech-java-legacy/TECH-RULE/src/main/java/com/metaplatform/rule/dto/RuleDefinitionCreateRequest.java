package com.metaplatform.rule.dto;

import com.metaplatform.rule.entity.ActionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Map;

@Data
public class RuleDefinitionCreateRequest {

    @NotBlank(message = "规则集 ID 不能为空")
    private String rulesetId;

    @NotBlank(message = "规则编码不能为空")
    @Size(max = 128, message = "规则编码长度不能超过 128")
    private String code;

    @NotBlank(message = "规则名称不能为空")
    @Size(max = 128, message = "规则名称长度不能超过 128")
    private String name;

    @Size(max = 2048, message = "描述长度不能超过 2048")
    private String description;

    @NotBlank(message = "条件表达式不能为空")
    private String conditionExpr;

    @NotNull(message = "动作类型不能为空")
    private ActionType actionType;

    private Map<String, Object> actionConfig;

    private Integer priority;

    private Boolean enabled;
}
