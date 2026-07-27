package com.metaplatform.mcp.tool.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateMcpToolRequest {

    private UUID serverId;

    @NotBlank(message = "name 不能为空")
    private String name;

    @NotBlank(message = "code 不能为空")
    private String code;

    private String description;

    private String category;

    private String inputSchema;

    private String outputSchema;

    private String toolType;

    private String endpoint;

    private String beanClass;

    private Boolean enabled;

    private java.util.List<String> tags;
}
