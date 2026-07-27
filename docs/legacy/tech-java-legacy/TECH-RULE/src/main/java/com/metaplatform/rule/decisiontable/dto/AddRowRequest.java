package com.metaplatform.rule.decisiontable.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

@Data
public class AddRowRequest {

    private Integer rowOrder;

    @NotNull(message = "输入值不能为空")
    private Map<String, Object> inputValues;

    @NotNull(message = "输出值不能为空")
    private Map<String, Object> outputValues;

    private Boolean enabled;
}
