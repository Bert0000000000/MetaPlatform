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
    private String description;
    private String inputSchema;
    private String outputSchema;
    private String toolType;
    private String endpoint;
    private String beanClass;
    private Boolean enabled;
    private Instant createdAt;
    private Instant updatedAt;
}
