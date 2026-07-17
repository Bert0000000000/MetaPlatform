package com.metaplatform.iam.controller;

import com.metaplatform.iam.common.ApiResponse;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.dto.apikey.ApiKeyCreatedResponse;
import com.metaplatform.iam.dto.apikey.ApiKeyResponse;
import com.metaplatform.iam.dto.apikey.CreateApiKeyRequest;
import com.metaplatform.iam.dto.apikey.PermissionsResponse;
import com.metaplatform.iam.dto.apikey.RevokeRequest;
import com.metaplatform.iam.dto.apikey.UpdatePermissionsRequest;
import com.metaplatform.iam.dto.apikey.ValidateRequest;
import com.metaplatform.iam.dto.apikey.ValidateResponse;
import com.metaplatform.iam.service.ApiKeyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/iam/api-keys")
@RequiredArgsConstructor
public class ApiKeyController {

    private final ApiKeyService apiKeyService;

    @PostMapping
    public ApiResponse<ApiKeyCreatedResponse> create(@Valid @RequestBody CreateApiKeyRequest request) {
        return ApiResponse.success(apiKeyService.create(
                request.getTenantId(), request.getName(), request.getUserId(),
                request.getScopes(), request.getExpiresAt()));
    }

    @GetMapping
    public ApiResponse<PageResponse<ApiKeyResponse>> list(
            @RequestParam(required = false) String tenantId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(apiKeyService.list(tenantId, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<ApiKeyResponse> get(@PathVariable String id) {
        return ApiResponse.success(apiKeyService.getById(id));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> revoke(@PathVariable String id) {
        apiKeyService.revoke(id);
        return ApiResponse.success();
    }

    /**
     * 吊销 API Key（含原因），PATCH 语义。
     */
    @PatchMapping("/{id}/revoke")
    public ApiResponse<Void> revokeWithReason(@PathVariable String id,
                                               @RequestBody(required = false) RevokeRequest request) {
        String reason = (request == null) ? null : request.getReason();
        apiKeyService.revoke(id, reason);
        return ApiResponse.success();
    }

    /**
     * 更新 API Key 的权限范围（覆盖式）。
     */
    @PutMapping("/{id}/permissions")
    public ApiResponse<Void> updatePermissions(@PathVariable String id,
                                                @Valid @RequestBody UpdatePermissionsRequest request) {
        apiKeyService.updatePermissions(id, request.getPermissions());
        return ApiResponse.success();
    }

    /**
     * 获取 API Key 的权限范围。
     */
    @GetMapping("/{id}/permissions")
    public ApiResponse<PermissionsResponse> getPermissions(@PathVariable String id) {
        return ApiResponse.success(PermissionsResponse.builder()
                .apiKeyId(id)
                .permissions(apiKeyService.getPermissions(id))
                .build());
    }

    /**
     * 验证 API Key 有效性及对指定资源的操作权限。
     */
    @PostMapping("/validate")
    public ApiResponse<ValidateResponse> validate(@Valid @RequestBody ValidateRequest request) {
        return ApiResponse.success(apiKeyService.validateWithPermissions(
                request.getApiKey(), request.getResource(), request.getAction()));
    }
}
