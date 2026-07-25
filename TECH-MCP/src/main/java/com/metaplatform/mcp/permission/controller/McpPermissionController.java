package com.metaplatform.mcp.permission.controller;

import com.metaplatform.mcp.common.ApiResponse;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.permission.dto.*;
import com.metaplatform.mcp.permission.service.McpPermissionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * MCP 权限控制 Controller（P0-1）。
 *
 * 三组端点：
 * 1. /rules        — 权限规则 CRUD
 * 2. /matrix       — 权限矩阵视图
 * 3. /check        — 权限检查（实时评估）
 */
@RestController
@RequestMapping("/api/v1/mcp/permissions")
@RequiredArgsConstructor
public class McpPermissionController {

    private final McpPermissionService permissionService;

    // ==================== 权限规则 CRUD ====================

    @PostMapping("/rules")
    public ApiResponse<PermissionRuleResponse> createRule(@Valid @RequestBody CreatePermissionRuleRequest request) {
        return ApiResponse.success(permissionService.create(request));
    }

    @GetMapping("/rules")
    public ApiResponse<PageResponse<PermissionRuleResponse>> listRules(
            @RequestParam(required = false) String subjectId,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(permissionService.list(subjectId, resourceType, page, size));
    }

    @GetMapping("/rules/{ruleId}")
    public ApiResponse<PermissionRuleResponse> getRule(@PathVariable String ruleId) {
        return ApiResponse.success(permissionService.get(ruleId));
    }

    @PutMapping("/rules/{ruleId}")
    public ApiResponse<PermissionRuleResponse> updateRule(@PathVariable String ruleId,
                                                           @RequestBody UpdatePermissionRuleRequest request) {
        return ApiResponse.success(permissionService.update(ruleId, request));
    }

    @DeleteMapping("/rules/{ruleId}")
    public ApiResponse<Void> deleteRule(@PathVariable String ruleId) {
        permissionService.delete(ruleId);
        return ApiResponse.success();
    }

    // ==================== 权限矩阵 ====================

    @GetMapping("/matrix")
    public ApiResponse<PermissionMatrixResponse> matrix(
            @RequestParam(required = false) String subjectId,
            @RequestParam(required = false) String resourceType) {
        return ApiResponse.success(permissionService.matrix(subjectId, resourceType));
    }

    // ==================== 权限检查 ====================

    @PostMapping("/check")
    public ApiResponse<PermissionCheckResponse> check(@Valid @RequestBody PermissionCheckRequest request) {
        return ApiResponse.success(permissionService.check(request));
    }
}
