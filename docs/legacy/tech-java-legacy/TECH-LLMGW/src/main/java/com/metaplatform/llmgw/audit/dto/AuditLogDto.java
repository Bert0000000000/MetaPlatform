package com.metaplatform.llmgw.audit.dto;

import java.time.LocalDateTime;

public record AuditLogDto(
        Long id,
        String traceId,
        String userId,
        String appId,
        String modelId,
        String endpoint,
        String method,
        Integer inputTokens,
        Integer outputTokens,
        Integer totalTokens,
        Long latencyMs,
        Integer statusCode,
        String errorMessage,
        String requestBody,
        String responseBody,
        String metadata,
        LocalDateTime createdAt
) {
}
