package com.metaplatform.iam.controller;

import com.metaplatform.iam.common.ApiResponse;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.dto.permission.CreatePermissionRequest;
import com.metaplatform.iam.dto.permission.PermissionCheckRequest;
import com.metaplatform.iam.dto.permission.PermissionCheckResponse;
import com.metaplatform.iam.dto.permission.PermissionResponse;
import com.metaplatform.iam.dto.permission.UpdatePermissionRequest;
import com.metaplatform.iam.service.PermissionCheckService;
import com.metaplatform.iam.service.PermissionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/iam/permissions")
@RequiredArgsConstructor
public class PermissionController {

    private final PermissionService permissionService;
    private final PermissionCheckService permissionCheckService;

    @PostMapping
    public ApiResponse<PermissionResponse> create(@Valid @RequestBody CreatePermissionRequest request) {
        return ApiResponse.success(permissionService.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<PermissionResponse>> list(
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(permissionService.list(tenantId, keyword, resourceType, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<PermissionResponse> get(@PathVariable String id) {
        return ApiResponse.success(permissionService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<PermissionResponse> update(@PathVariable String id,
                                                  @Valid @RequestBody UpdatePermissionRequest request) {
        return ApiResponse.success(permissionService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id,
                                     @RequestParam(required = false) Boolean force) {
        permissionService.softDelete(id, force);
        return ApiResponse.success();
    }

    @PostMapping("/check")
    public ApiResponse<PermissionCheckResponse> check(@Valid @RequestBody PermissionCheckRequest request) {
        return ApiResponse.success(permissionCheckService.check(request));
    }
}