package com.metaplatform.rule.decisiontable.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DecisionTableResponse {

    private String id;
    private String tenantId;
    private String rulesetId;
    private String name;
    private String code;
    private String description;
    private String hitPolicy;
    private List<DecisionTableColumnDto> inputColumns;
    private List<DecisionTableColumnDto> outputColumns;
    private String status;
    private Integer version;
    private Instant createdAt;
    private Instant updatedAt;
    private String createdBy;
    private String updatedBy;
}
