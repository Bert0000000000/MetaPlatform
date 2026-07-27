package com.metaplatform.mcp.externalapp.dto;

import lombok.Builder;

import java.util.List;

/**
 * 应用工具授权响应：返回 appId + 已授权的 toolId 列表。
 * 工具授权复用 mcp_permission_rules（subjectType=EXTERNAL_APP, subjectId=appId, resourceType=TOOL, effect=ALLOW）。
 */
@Builder
public record AppToolGrantResponse(
        String appId,
        List<String> toolIds
) {
}
