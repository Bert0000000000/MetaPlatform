package com.metaplatform.action.definition.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

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

    private Map<String, Object> headers;

    @NotNull(message = "inputSchema 不能为空")
    private Map<String, Object> inputSchema;

    @NotNull(message = "outputSchema 不能为空")
    private Map<String, Object> outputSchema;
}