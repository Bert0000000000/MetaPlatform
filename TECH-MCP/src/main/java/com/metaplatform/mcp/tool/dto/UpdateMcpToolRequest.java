package com.metaplatform.mcp.tool.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class UpdateMcpToolRequest {

    private UUID serverId;
    private String name;
    private String description;
    private String inputSchema;
    private String outputSchema;
    private String toolType;
    private String endpoint;
    private String beanClass;
    private Boolean enabled;
}
