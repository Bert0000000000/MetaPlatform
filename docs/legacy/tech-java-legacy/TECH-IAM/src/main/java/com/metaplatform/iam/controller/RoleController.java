package com.metaplatform.iam.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.common.ApiResponse;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.dto.permission.PermissionResponse;
import com.metaplatform.iam.dto.role.AssignRolePermissionsRequest;
import com.metaplatform.iam.dto.role.AssignRolePermissionsResponse;
import com.metaplatform.iam.dto.role.CreateRoleRequest;
import com.metaplatform.iam.dto.role.RoleResponse;
import com.metaplatform.iam.dto.role.UpdateRoleRequest;
import com.metaplatform.iam.entity.PermissionEntity;
import com.metaplatform.iam.service.RoleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/iam/roles")
@RequiredArgsConstructor
public class RoleController {

    private final RoleService roleService;
    private final ObjectMapper objectMapper;

    @PostMapping
    public ApiResponse<RoleResponse> create(@Valid @RequestBody CreateRoleRequest request) {
        return ApiResponse.success(roleService.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<RoleResponse>> list(
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(roleService.list(tenantId, keyword, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<RoleResponse> get(@PathVariable String id) {
        return ApiResponse.success(roleService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<RoleResponse> update(@PathVariable String id,
                                            @Valid @RequestBody UpdateRoleRequest request) {
        return ApiResponse.success(roleService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        roleService.softDelete(id);
        return ApiResponse.success();
    }

    @PostMapping("/{id}/permissions")
    public ApiResponse<AssignRolePermissionsResponse> assignPermissions(
            @PathVariable String id,
            @Valid @RequestBody AssignRolePermissionsRequest request) {
        return ApiResponse.success(roleService.assignPermissions(id, request));
    }

    @GetMapping("/{id}/permissions")
    public ApiResponse<List<PermissionResponse>> listPermissions(@PathVariable String id) {
        List<PermissionEntity> permissions = roleService.listPermissionsOfRole(id);
        List<PermissionResponse> items = permissions.stream().map(this::toPermissionResponse).toList();
        return ApiResponse.success(items);
    }

    private PermissionResponse toPermissionResponse(PermissionEntity p) {
        return PermissionResponse.builder()
                .permissionId(p.getId())
                .permissionCode(p.getPermissionCode())
                .permissionName(p.getPermissionName())
                .resourceType(p.getResourceType())
                .resourceId(p.getResourceId())
                .actions(readJson(p.getActions()))
                .effect(p.getEffect())
                .description(p.getDescription())
                .version(p.getVersion())
                .roleCount(0L)
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .createdBy(p.getCreatedBy())
                .updatedBy(p.getUpdatedBy())
                .build();
    }

    private List<String> readJson(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (JsonProcessingException e) {
            log.warn("actions 反序列化失败: {}", json, e);
            return Collections.emptyList();
        }
    }
}