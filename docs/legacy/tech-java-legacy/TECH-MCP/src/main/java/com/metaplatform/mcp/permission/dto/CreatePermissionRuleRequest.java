package com.metaplatform.mcp.permission.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * 创建权限规则请求。
 * subjectType: USER / ROLE / AGENT / EXTERNAL_APP
 * resourceType: TOOL / RESOURCE / PROMPT / SERVER
 * actions: 逗号分隔，如 "execute,read,list"
 * effect: ALLOW / DENY
 */
public record CreatePermissionRuleRequest(
        @NotBlank(message = "name 不能为空") String name,
        @NotBlank(message = "subjectType 不能为空")
        @Pattern(regexp = "USER|ROLE|AGENT|EXTERNAL_APP", message = "subjectType 必须是 USER/ROLE/AGENT/EXTERNAL_APP")
        String subjectType,
        @NotBlank(message = "subjectId 不能为空") String subjectId,
        @NotBlank(message = "resourceType 不能为空")
        @Pattern(regexp = "TOOL|RESOURCE|PROMPT|SERVER", message = "resourceType 必须是 TOOL/RESOURCE/PROMPT/SERVER")
        String resourceType,
        String resourceId,
        @NotBlank(message = "actions 不能为空") String actions,
        @NotBlank(message = "effect 不能为空")
        @Pattern(regexp = "ALLOW|DENY", message = "effect 必须是 ALLOW 或 DENY")
        String effect,
        Integer priority,
        Boolean enabled
) {
}
