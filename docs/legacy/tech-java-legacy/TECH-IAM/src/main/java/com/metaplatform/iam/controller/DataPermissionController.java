package com.metaplatform.iam.controller;

import com.metaplatform.iam.common.ApiResponse;
import com.metaplatform.iam.dto.datapermission.CreateDataPermissionRequest;
import com.metaplatform.iam.dto.datapermission.DataPermissionResponse;
import com.metaplatform.iam.dto.datapermission.DataScopeResolveResponse;
import com.metaplatform.iam.dto.datapermission.UpdateDataPermissionRequest;
import com.metaplatform.iam.service.DataPermissionService;
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

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

@RestController
@RequestMapping("/api/v1/iam/data-permissions")
@RequiredArgsConstructor
public class DataPermissionController {

    private final DataPermissionService dataPermissionService;

    @PostMapping
    public ApiResponse<DataPermissionResponse> create(@Valid @RequestBody CreateDataPermissionRequest request) {
        return ApiResponse.success(dataPermissionService.create(request));
    }

    @GetMapping
    public ApiResponse<List<DataPermissionResponse>> list(
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String roleId,
            @RequestParam(required = false) String resourceType) {
        return ApiResponse.success(dataPermissionService.list(tenantId, roleId, resourceType));
    }

    @GetMapping("/{id}")
    public ApiResponse<DataPermissionResponse> get(@PathVariable String id) {
        return ApiResponse.success(dataPermissionService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<DataPermissionResponse> update(@PathVariable String id,
                                                       @Valid @RequestBody UpdateDataPermissionRequest request) {
        return ApiResponse.success(dataPermissionService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        dataPermissionService.delete(id);
        return ApiResponse.success();
    }

    @GetMapping("/resolve")
    public ApiResponse<DataScopeResolveResponse> resolve(
            @RequestParam String userId,
            @RequestParam String resourceType,
            @RequestParam(required = false) String roleIds) {
        List<String> roleIdList = parseRoleIds(roleIds);
        return ApiResponse.success(dataPermissionService.resolve(userId, roleIdList, resourceType));
    }

    private List<String> parseRoleIds(String roleIds) {
        if (roleIds == null || roleIds.isBlank()) {
            return Collections.emptyList();
        }
        return Arrays.stream(roleIds.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
