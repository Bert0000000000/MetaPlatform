package com.metaplatform.mcp.permission.dto;

/**
 * 更新权限规则请求（部分字段，null 表示不更新）。
 */
public record UpdatePermissionRuleRequest(
        String name,
        String subjectType,
        String subjectId,
        String resourceType,
        String resourceId,
        String actions,
        String effect,
        Integer priority,
        Boolean enabled
) {
}
