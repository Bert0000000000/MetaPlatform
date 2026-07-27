package com.metaplatform.rule.decisiontable.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class CreateDecisionTableRequest {

    @NotBlank(message = "决策表名称不能为空")
    @Size(max = 128, message = "决策表名称长度不能超过 128")
    private String name;

    @NotBlank(message = "决策表编码不能为空")
    @Size(max = 128, message = "决策表编码长度不能超过 128")
    private String code;

    @Size(max = 2048, message = "描述长度不能超过 2048")
    private String description;

    private String rulesetId;

    private String hitPolicy;

    private List<DecisionTableColumnDto> inputColumns;

    private List<DecisionTableColumnDto> outputColumns;
}
