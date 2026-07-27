package com.metaplatform.rag.context.dto;

import java.util.UUID;

public record ContextSource(
    UUID chunkId,
    UUID docId,
    String content,
    String sourceType,
    Double score
) {
}
