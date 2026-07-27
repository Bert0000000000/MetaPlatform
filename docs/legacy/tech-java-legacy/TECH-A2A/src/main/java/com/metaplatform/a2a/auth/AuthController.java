package com.metaplatform.a2a.auth;

import com.metaplatform.a2a.common.ApiResponse;
import com.metaplatform.a2a.common.TenantContext;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 认证与 API Key 管理端点。
 *
 * <p>对应 Python {@code app.api.v1.auth}。</p>
 */
@RestController
@RequestMapping("/api/v1/a2a/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * 为 Agent 生成新的 API Key。
     */
    @PostMapping("/api-keys")
    public ApiResponse<Map<String, Object>> createApiKey(
            @RequestBody CreateApiKeyRequest request) {
        Map<String, Object> result = authService.createApiKey(
                TenantContext.getTenantIdOrDefault(),
                request.getAgentId(),
                request.getPermissions());
        return ApiResponse.success(result);
    }

    /**
     * 列出某 Agent 的所有 API Key。
     */
    @GetMapping("/api-keys")
    public ApiResponse<List<Map<String, Object>>> listApiKeys(
            @RequestParam @NotBlank String agentId) {
        List<Map<String, Object>> result = authService.listApiKeys(
                TenantContext.getTenantIdOrDefault(), agentId);
        return ApiResponse.success(result);
    }

    /**
     * 撤销 API Key。
     */
    @DeleteMapping("/api-keys/{keyId}")
    public ApiResponse<Map<String, Object>> revokeApiKey(
            @PathVariable String keyId) {
        boolean ok = authService.revokeApiKey(
                TenantContext.getTenantIdOrDefault(), keyId);
        return ApiResponse.success(Map.of("revoked", ok, "keyId", keyId));
    }

    /**
     * 验证 API Key（用于调试 / 测试）。
     */
    @PostMapping("/api-keys/verify")
    public ApiResponse<Map<String, Object>> verifyApiKey(
            @RequestParam String apiKey) {
        Map<String, Object> result = authService.verifyApiKey(apiKey);
        return ApiResponse.success(result);
    }

    /**
     * 创建 API Key 请求体。
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateApiKeyRequest {
        @NotBlank
        private String agentId;
        private List<String> permissions;
    }
}
