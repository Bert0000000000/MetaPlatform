package com.metaplatform.mcp.externalapp.dto;

import lombok.Builder;

import java.time.OffsetDateTime;

@Builder
public record AppConfigResponse(
        String appId,
        Integer rateLimitQps,
        Integer timeoutMs,
        String allowedTools,
        String deniedTools,
        String webhookUrl,
        String metadata,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
