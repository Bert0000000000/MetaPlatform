package com.metaplatform.rag.citations.dto;

import java.util.UUID;

public record CitationDto(
    UUID chunkId,
    UUID docId,
    String content,
    Double score
) {
}
