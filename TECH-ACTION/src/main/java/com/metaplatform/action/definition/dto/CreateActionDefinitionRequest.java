package com.metaplatform.action.definition.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateActionDefinitionRequest {

    @NotBlank(message = "code 不能为空")
    private String code;

    @NotBlank(message = "name 不能为空")
    private String name;

    private String description;

    @NotBlank(message = "method 不能为空")
    private String method;

    @NotBlank(message = "url 不能为空")
    private String url;

    private String headers;

    @NotNull(message = "inputSchema 不能为空")
    private String inputSchema;

    @NotNull(message = "outputSchema 不能为空")
    private String outputSchema;
}
