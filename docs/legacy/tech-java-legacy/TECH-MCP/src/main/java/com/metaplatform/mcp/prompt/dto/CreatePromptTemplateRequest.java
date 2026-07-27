package com.metaplatform.mcp.prompt.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreatePromptTemplateRequest {

    @NotBlank(message = "name 不能为空")
    private String name;

    private String description;

    @NotBlank(message = "template 不能为空")
    private String template;

    private String variables;

    private String category;
}