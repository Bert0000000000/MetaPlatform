package com.metaplatform.wfe.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 流程变量绑定业务对象请求。
 */
@Data
public class BindVariableRequest {

    @NotBlank(message = "变量名不能为空")
    private String variableName;

    @NotBlank(message = "概念编码不能为空")
    private String conceptCode;

    @NotBlank(message = "实体编码不能为空")
    private String entityCode;
}
