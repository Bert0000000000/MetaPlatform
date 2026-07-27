package com.metaplatform.rag.knowledge.dto;

public record RetrievalConfigDto(
    Integer topK,
    Double scoreThreshold,
    Double hybridWeight,
    Boolean rerankEnabled,
    String rerankModel
) {
}
