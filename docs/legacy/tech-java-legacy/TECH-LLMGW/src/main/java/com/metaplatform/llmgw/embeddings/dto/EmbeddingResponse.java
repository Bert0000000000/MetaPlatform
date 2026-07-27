package com.metaplatform.llmgw.embeddings.dto;

import java.util.List;

public record EmbeddingResponse(
    String model,
    List<EmbeddingData> data,
    Usage usage
) {
    public record EmbeddingData(int index, List<Float> embedding, String object) {}
    public record Usage(int promptTokens, int totalTokens) {}
}
