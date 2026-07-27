package com.metaplatform.rule.decisiontable.dto;

import lombok.Data;

import java.util.List;

@Data
public class UpdateDecisionTableRequest {

    private String name;
    private String description;
    private String rulesetId;
    private String hitPolicy;
    private String status;
    private List<DecisionTableColumnDto> inputColumns;
    private List<DecisionTableColumnDto> outputColumns;
}
