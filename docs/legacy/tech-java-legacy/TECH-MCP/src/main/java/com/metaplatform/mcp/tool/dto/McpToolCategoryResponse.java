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
public class McpToolCategoryResponse {

    private UUID id;
    private String name;
    private String code;
    private String description;
    private Integer sortOrder;
    private UUID parentId;
    private Instant createdAt;
    private Instant updatedAt;
}
