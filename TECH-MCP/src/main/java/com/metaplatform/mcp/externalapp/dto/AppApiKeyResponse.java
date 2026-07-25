package com.metaplatform.mcp.externalapp.dto;

import lombok.Builder;

import java.time.OffsetDateTime;

@Builder
public record AppApiKeyResponse(
        String keyId,
        String appId,
        String name,
        String status,
        OffsetDateTime lastUsedAt,
        OffsetDateTime createdAt
) {
}
