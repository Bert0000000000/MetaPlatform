package com.metaplatform.rag.documents.dto;

import java.util.UUID;

public record UploadResult(
    UUID documentId,
    String fileName,
    String status
) {
}
