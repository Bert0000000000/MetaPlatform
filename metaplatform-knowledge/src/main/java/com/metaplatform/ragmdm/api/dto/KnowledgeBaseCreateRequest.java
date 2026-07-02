package com.metaplatform.ragmdm.api.dto;

import com.metaplatform.ragmdm.domain.enums.KnowledgeBaseType;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class KnowledgeBaseCreateRequest {

    @NotBlank(message = "Code must not be blank")
    private String code;

    @NotBlank(message = "Name must not be blank")
    private String name;

    private String description;
    private KnowledgeBaseType type;
    private Integer chunkSize;
    private Integer chunkOverlap;
    private String embeddingModel;
}
