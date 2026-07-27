package com.metaplatform.mcp.externalapp.dto;

/**
 * 应用配置更新请求（PUT 语义：upsert，null 字段不覆盖已有值）。
 * allowedTools / deniedTools / metadata 为 JSON 字符串。
 */
public record UpdateAppConfigRequest(
        Integer rateLimitQps,
        Integer timeoutMs,
        String allowedTools,
        String deniedTools,
        String webhookUrl,
        String metadata
) {
}
