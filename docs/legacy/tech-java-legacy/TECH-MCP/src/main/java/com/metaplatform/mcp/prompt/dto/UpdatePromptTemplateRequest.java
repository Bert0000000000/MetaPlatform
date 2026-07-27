package com.metaplatform.mcp.prompt.dto;

import lombok.Data;

@Data
public class UpdatePromptTemplateRequest {

    private String name;
    private String description;
    private String template;
    private String variables;
    private String status;
    private String category;
}