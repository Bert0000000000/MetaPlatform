package com.metaplatform.rule.decisiontable.dto;

import lombok.Data;

import java.util.Map;

@Data
public class UpdateRowRequest {

    private Integer rowOrder;
    private Map<String, Object> inputValues;
    private Map<String, Object> outputValues;
    private Boolean enabled;
}
