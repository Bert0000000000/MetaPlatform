package com.metaplatform.mcp.externalapp.dto;

import lombok.Builder;

/**
 * API Key 创建响应：明文 apiKey 仅此一次返回，后续只存 BCrypt hash。
 * apiKey 格式：keyId:secret（与 IamAuthFilter 解析逻辑对齐）。
 */
@Builder
public record AppApiKeyCreatedResponse(
        String keyId,
        String appId,
        String name,
        String apiKey,
        String status
) {
}
