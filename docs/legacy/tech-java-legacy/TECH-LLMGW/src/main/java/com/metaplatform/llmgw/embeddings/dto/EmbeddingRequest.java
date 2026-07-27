package com.metaplatform.llmgw.embeddings.dto;

import java.util.List;

public record EmbeddingRequest(
    String model,
    List<String> input
) {
    public EmbeddingRequest {
        if (model == null || model.isBlank()) model = "text-embedding-v3";
    }
}
