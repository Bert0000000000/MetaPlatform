package com.metaplatform.mcp.resource.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateResourceRequest {

    @NotBlank(message = "name 不能为空")
    private String name;

    @NotBlank(message = "uri 不能为空")
    private String uri;

    private String description;

    private String mimeType;

    private String content;

    private String metadata;

    private String relatedConceptId;
}