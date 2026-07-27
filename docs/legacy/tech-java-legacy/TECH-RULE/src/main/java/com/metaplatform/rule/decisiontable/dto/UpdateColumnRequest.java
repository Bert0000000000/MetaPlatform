package com.metaplatform.rule.decisiontable.dto;

import lombok.Data;

@Data
public class UpdateColumnRequest {

    private String name;
    private String field;
    private String dataType;
    private String expression;
}
