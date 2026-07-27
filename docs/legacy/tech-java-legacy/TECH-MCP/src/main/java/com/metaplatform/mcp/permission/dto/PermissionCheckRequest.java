package com.metaplatform.mcp.permission.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 权限检查请求。
 * action: execute / read / list
 */
public record PermissionCheckRequest(
        @NotBlank(message = "subjectId 不能为空") String subjectId,
        @NotBlank(message = "resourceType 不能为空") String resourceType,
        String resourceId,
        @NotBlank(message = "action 不能为空") String action
) {
}
