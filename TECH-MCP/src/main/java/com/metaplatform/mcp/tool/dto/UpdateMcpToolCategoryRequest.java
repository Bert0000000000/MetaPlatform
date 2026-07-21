package com.metaplatform.mcp.tool.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class UpdateMcpToolCategoryRequest {

    private String name;
    private String description;
    private Integer sortOrder;
    private UUID parentId;
}
