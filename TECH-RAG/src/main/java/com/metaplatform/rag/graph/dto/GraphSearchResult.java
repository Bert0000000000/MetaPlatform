package com.metaplatform.rag.graph.dto;

import java.util.UUID;

public record GraphSearchResult(
    UUID chunkId,
    UUID docId,
    String content,
    String relationType,
    Double score
) {
}
