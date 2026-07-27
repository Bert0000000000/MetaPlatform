package com.metaplatform.mcp.tool.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class UpdateMcpToolRequest {

    private UUID serverId;
    private String name;
    private String description;
    private String category;
    private String inputSchema;
    private String outputSchema;
    private String toolType;
    private String endpoint;
    private String beanClass;
    private Boolean enabled;
    private java.util.List<String> tags;
    private String changeLog;
}
