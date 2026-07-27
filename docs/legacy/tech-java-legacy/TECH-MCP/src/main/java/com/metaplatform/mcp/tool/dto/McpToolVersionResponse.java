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
public class McpToolVersionResponse {

    private UUID id;
    private UUID toolId;
    private String version;
    private String schema;
    private String description;
    private String changeLog;
    private Boolean isCurrent;
    private Instant createdAt;
    private String createdBy;
}
