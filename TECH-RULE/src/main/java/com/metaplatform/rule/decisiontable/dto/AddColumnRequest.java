package com.metaplatform.rule.decisiontable.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AddColumnRequest {

    @NotBlank(message = "列类型不能为空（INPUT 或 OUTPUT）")
    private String columnType;

    @NotBlank(message = "列名称不能为空")
    private String name;

    private String field;
    private String dataType;
    private String expression;
}
