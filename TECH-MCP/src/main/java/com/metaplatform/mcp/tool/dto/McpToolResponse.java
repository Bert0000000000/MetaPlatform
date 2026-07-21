package com.metaplatform.mcp.tool.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class McpToolResponse {

    private UUID id;
    private UUID serverId;
    private String name;
    private String code;
    private String category;
    private String version;
    private String description;
    private String inputSchema;
    private String outputSchema;
    private String toolType;
    private String endpoint;
    private String beanClass;
    private Boolean enabled;
    private java.util.List<String> tags;
    private Instant createdAt;
    private Instant updatedAt;
}
