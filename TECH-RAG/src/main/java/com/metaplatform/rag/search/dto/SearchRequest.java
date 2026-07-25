package com.metaplatform.rag.search.dto;

public record SearchRequest(
    String query,
    Integer topK,
    Double scoreThreshold,
    Double hybridWeight
) {
}
