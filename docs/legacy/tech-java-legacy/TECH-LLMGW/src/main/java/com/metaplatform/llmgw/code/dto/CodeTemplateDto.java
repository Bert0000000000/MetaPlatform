package com.metaplatform.llmgw.code.dto;

import java.time.LocalDateTime;
import java.util.Map;

public record CodeTemplateDto(
        Long id,
        String name,
        String description,
        String language,
        String templateText,
        Map<String, Object> variables,
        Boolean isActive,
        String createdBy,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
