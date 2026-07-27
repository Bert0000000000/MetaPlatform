package com.metaplatform.a2a.agentregistry;

import com.metaplatform.a2a.common.ApiResponse;
import com.metaplatform.a2a.common.PageResponse;
import com.metaplatform.a2a.common.TenantContext;
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

import java.util.Map;

/**
 * Agent 注册表端点。
 *
 * <p>对应 Python {@code app.api.v1.registry}。</p>
 */
@RestController
@RequestMapping("/api/v1/a2a/registry")
@RequiredArgsConstructor
public class AgentRegistryController {

    private final AgentRegistryService registryService;

    @PostMapping("/register")
    public ApiResponse<Map<String, Object>> register(
            @Valid @RequestBody AgentRegistrationRequest request) {
        return ApiResponse.success(registryService.register(
                TenantContext.getTenantIdOrDefault(), request, TenantContext.getUserId()));
    }

    @DeleteMapping("/agents/{agentId}")
    public ApiResponse<Map<String, Object>> deregister(@PathVariable String agentId) {
        boolean ok = registryService.deregister(
                TenantContext.getTenantIdOrDefault(), agentId, TenantContext.getUserId());
        return ApiResponse.success(Map.of("deregistered", ok, "agentId", agentId));
    }

    @PostMapping("/agents/{agentId}/heartbeat")
    public ApiResponse<Map<String, Object>> heartbeat(@PathVariable String agentId) {
        return ApiResponse.success(registryService.heartbeat(
                TenantContext.getTenantIdOrDefault(), agentId));
    }

    @PostMapping("/health-check")
    public ApiResponse<Map<String, Object>> healthCheck() {
        return ApiResponse.success(registryService.healthCheck(
                TenantContext.getTenantIdOrDefault()));
    }

    @GetMapping("/agents/{agentId}")
    public ApiResponse<Map<String, Object>> get(@PathVariable String agentId) {
        return ApiResponse.success(registryService.get(
                TenantContext.getTenantIdOrDefault(), agentId));
    }

    @GetMapping("/agents")
    public ApiResponse<PageResponse<Map<String, Object>>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(registryService.list(
                TenantContext.getTenantIdOrDefault(), status, page, pageSize));
    }
}
