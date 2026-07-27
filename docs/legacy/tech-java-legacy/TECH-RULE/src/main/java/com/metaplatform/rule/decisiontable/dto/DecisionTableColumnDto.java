package com.metaplatform.rule.decisiontable.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DecisionTableColumnDto {

    private String id;
    private String name;
    private String field;
    private String dataType;
    private String expression;
    private String columnType;
}
