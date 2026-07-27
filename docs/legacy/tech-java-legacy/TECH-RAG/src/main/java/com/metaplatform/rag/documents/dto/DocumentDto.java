package com.metaplatform.rag.documents.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DocumentDto(
    UUID id,
    UUID kbId,
    String title,
    String fileName,
    Long fileSize,
    String fileType,
    String filePath,
    String status,
    Integer chunkCount,
    String errorMessage,
    Object metadata,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
}
