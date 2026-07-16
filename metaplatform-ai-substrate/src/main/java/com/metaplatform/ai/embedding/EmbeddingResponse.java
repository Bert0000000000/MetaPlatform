package com.metaplatform.ai.embedding;

import java.util.List;

public record EmbeddingResponse(
    String model,
    List<Embedding> embeddings
) {
    public record Embedding(
        int index,
        List<Float> vector
    ) {}
}
