package com.metaplatform.ragmdm.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RagQueryRequest {

    @NotBlank(message = "Query must not be blank")
    private String query;

    private Long knowledgeBaseId;

    private int topK = 5;
}
