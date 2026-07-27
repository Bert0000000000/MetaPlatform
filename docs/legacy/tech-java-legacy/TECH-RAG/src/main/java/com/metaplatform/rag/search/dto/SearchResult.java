package com.metaplatform.rag.search.dto;

import java.util.UUID;

public record SearchResult(
    UUID chunkId,
    UUID docId,
    String content,
    Double score,
    String source
) {
}
