package com.metaplatform.llmgw.prompts.dto;

import java.time.LocalDateTime;
import java.util.Map;

public record PromptDto(
    Long id,
    String name,
    String description,
    String category,
    String templateText,
    Map<String, Object> variables,
    Integer version,
    Boolean isActive,
    String createdBy,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {}
