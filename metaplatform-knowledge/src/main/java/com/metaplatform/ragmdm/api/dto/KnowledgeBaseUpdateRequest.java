package com.metaplatform.ragmdm.api.dto;

import lombok.Data;

@Data
public class KnowledgeBaseUpdateRequest {

    private String name;
    private String description;
    private Integer chunkSize;
    private Integer chunkOverlap;
}
