package com.metaplatform.ai.embedding;

import java.util.List;

public record EmbeddingRequest(
    String model,
    List<String> texts
) {
    public EmbeddingRequest {
        if (texts == null || texts.isEmpty()) {
            throw new IllegalArgumentException("texts must not be empty");
        }
    }
}
