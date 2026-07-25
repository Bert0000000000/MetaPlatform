package com.metaplatform.llmgw.code.dto;

import java.time.LocalDateTime;
import java.util.List;

public record CodeSnippetDto(
        Long id,
        Long templateId,
        String title,
        String language,
        String codeText,
        String description,
        List<String> tags,
        Integer version,
        String createdBy,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
