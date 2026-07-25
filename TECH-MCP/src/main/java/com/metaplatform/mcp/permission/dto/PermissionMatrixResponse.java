package com.metaplatform.mcp.permission.dto;

import lombok.Builder;

import java.util.List;

/**
 * 权限矩阵响应。
 * subjects / resources 为去重后的轴；permissions 为二维矩阵，外层按 subjects 顺序，内层按 resources 顺序。
 * 每个单元格基于 action=execute 评估（默认动作），allowed=true 表示存在生效的 ALLOW 且无更高优先级的 DENY。
 */
@Builder
public record PermissionMatrixResponse(
        List<SubjectKey> subjects,
        List<ResourceKey> resources,
        List<List<MatrixCell>> permissions
) {
    @Builder
    public record SubjectKey(String subjectType, String subjectId) {
    }

    @Builder
    public record ResourceKey(String resourceType, String resourceId) {
    }

    @Builder
    public record MatrixCell(boolean allowed, List<String> ruleIds) {
    }
}
