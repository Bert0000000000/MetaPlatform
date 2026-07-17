package com.metaplatform.mcp.resource.dto;

import lombok.Data;

@Data
public class UpdateResourceRequest {

    private String name;
    private String description;
    private String mimeType;
    private String content;
    private String metadata;
    private String relatedConceptId;
}