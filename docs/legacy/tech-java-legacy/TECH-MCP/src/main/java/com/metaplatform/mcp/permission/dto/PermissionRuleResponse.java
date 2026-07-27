package com.metaplatform.mcp.permission.dto;

import lombok.Builder;

import java.time.OffsetDateTime;

@Builder
public record PermissionRuleResponse(
        Long id,
        String ruleId,
        String name,
        String subjectType,
        String subjectId,
        String resourceType,
        String resourceId,
        String actions,
        String effect,
        Integer priority,
        Boolean enabled,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
