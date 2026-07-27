package com.metaplatform.mcp.externalapp.dto;

import java.util.List;

/**
 * 应用工具授权更新请求：全量替换 appId 可调用的 toolId 列表。
 */
public record UpdateAppToolGrantRequest(
        List<String> toolIds
) {
}
