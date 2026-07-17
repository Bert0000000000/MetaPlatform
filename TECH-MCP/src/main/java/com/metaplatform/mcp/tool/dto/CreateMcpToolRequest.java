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

    private String inputSchema;

    private String outputSchema;

    @NotBlank(message = "toolType 不能为空")
    private String toolType;

    private String endpoint;

    private String beanClass;

    private Boolean enabled;
}
