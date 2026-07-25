package com.metaplatform.rag.knowledge.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record KnowledgeBaseDto(
    UUID id,
    String name,
    String description,
    String embeddingModel,
    RetrievalConfigDto retrievalConfig,
    Boolean isActive,
    String createdBy,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
}
