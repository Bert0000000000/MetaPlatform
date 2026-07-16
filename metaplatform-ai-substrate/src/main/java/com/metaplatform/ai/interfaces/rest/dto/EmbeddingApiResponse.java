package com.metaplatform.ai.interfaces.rest.dto;

import java.util.List;

public record EmbeddingApiResponse(
    String model,
    List<List<Float>> embeddings
) {}
