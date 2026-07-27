package com.metaplatform.mcp.externalapp.controller;

import com.metaplatform.mcp.common.ApiResponse;
import com.metaplatform.mcp.externalapp.dto.*;
import com.metaplatform.mcp.externalapp.service.McpAppConfigService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 外部应用子资源 Controller（P0-6）。
 *
 * 三组子端点（挂在 /api/v1/mcp/external-agents/{appId} 下）：
 * 1. /config     — 应用配置 GET/PUT
 * 2. /api-keys   — 应用 API Key GET/POST/DELETE
 * 3. /tools      — 应用工具授权 GET/PUT
 *
 * 与 ExternalAgentController 共享基础路径，子路径不冲突（config/api-keys/tools vs test-connection）。
 */
@RestController
@RequestMapping("/api/v1/mcp/external-agents")
@RequiredArgsConstructor
public class ExternalAppConfigController {

    private final McpAppConfigService appConfigService;

    // ==================== 应用配置 ====================

    @GetMapping("/{appId}/config")
    public ApiResponse<AppConfigResponse> getConfig(@PathVariable String appId) {
        return ApiResponse.success(appConfigService.getConfig(appId));
    }

    @PutMapping("/{appId}/config")
    public ApiResponse<AppConfigResponse> upsertConfig(@PathVariable String appId,
                                                        @RequestBody UpdateAppConfigRequest request) {
        return ApiResponse.success(appConfigService.upsertConfig(appId, request));
    }

    // ==================== 应用 API Key ====================

    @GetMapping("/{appId}/api-keys")
    public ApiResponse<List<AppApiKeyResponse>> listApiKeys(@PathVariable String appId) {
        return ApiResponse.success(appConfigService.listApiKeys(appId));
    }

    @PostMapping("/{appId}/api-keys")
    public ApiResponse<AppApiKeyCreatedResponse> createApiKey(@PathVariable String appId,
                                                              @Valid @RequestBody CreateAppApiKeyRequest request) {
        return ApiResponse.success(appConfigService.createApiKey(appId, request));
    }

    @DeleteMapping("/{appId}/api-keys/{keyId}")
    public ApiResponse<Void> deleteApiKey(@PathVariable String appId,
                                          @PathVariable String keyId,
                                          @RequestParam(required = false) Boolean revoke) {
        if (Boolean.TRUE.equals(revoke)) {
            appConfigService.revokeApiKey(appId, keyId);
        } else {
            appConfigService.deleteApiKey(appId, keyId);
        }
        return ApiResponse.success();
    }

    // ==================== 应用工具授权 ====================

    @GetMapping("/{appId}/tools")
    public ApiResponse<AppToolGrantResponse> listToolGrants(@PathVariable String appId) {
        return ApiResponse.success(appConfigService.listToolGrants(appId));
    }

    @PutMapping("/{appId}/tools")
    public ApiResponse<AppToolGrantResponse> replaceToolGrants(@PathVariable String appId,
                                                               @RequestBody UpdateAppToolGrantRequest request) {
        return ApiResponse.success(appConfigService.replaceToolGrants(appId, request));
    }
}
