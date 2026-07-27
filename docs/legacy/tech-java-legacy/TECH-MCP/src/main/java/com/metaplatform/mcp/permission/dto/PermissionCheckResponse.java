package com.metaplatform.mcp.permission.dto;

import lombok.Builder;

import java.util.List;

@Builder
public record PermissionCheckResponse(
        boolean allowed,
        String decision,
        String effect,
        List<MatchedRule> matchedRules,
        String reason
) {
    @Builder
    public record MatchedRule(
            String ruleId,
            String name,
            String effect,
            Integer priority,
            String actions
    ) {
    }
}
