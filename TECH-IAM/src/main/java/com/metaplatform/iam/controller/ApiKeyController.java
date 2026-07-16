package com.metaplatform.iam.controller;

import com.metaplatform.iam.common.ApiResponse;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.dto.apikey.ApiKeyCreatedResponse;
import com.metaplatform.iam.dto.apikey.ApiKeyResponse;
import com.metaplatform.iam.dto.apikey.CreateApiKeyRequest;
import com.metaplatform.iam.service.ApiKeyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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
}
