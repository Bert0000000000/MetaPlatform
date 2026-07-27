package com.metaplatform.rag.knowledge.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateKnowledgeBaseRequest(
    @NotBlank String name,
    String description,
    String embeddingModel,
    RetrievalConfigDto retrievalConfig
) {
}
