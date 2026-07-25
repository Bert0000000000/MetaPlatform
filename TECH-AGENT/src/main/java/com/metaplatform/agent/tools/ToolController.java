package com.metaplatform.agent.tools;

import com.metaplatform.agent.common.ApiResponse;
import com.metaplatform.agent.common.TenantContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Agent 工具管理端点。
 */
@RestController
@RequestMapping("/api/v1/agent/tools")
@RequiredArgsConstructor
public class ToolController {

    private final ToolService toolService;

    @PostMapping
    public ApiResponse<ToolResponse> register(@Valid @RequestBody CreateToolRequest request) {
        return ApiResponse.success(toolService.register(TenantContext.getTenantIdOrDefault(), request));
    }

    @GetMapping
    public ApiResponse<List<ToolResponse>> list(
            @RequestParam String agentId,
            @RequestParam(defaultValue = "false") boolean enabledOnly) {
        return ApiResponse.success(toolService.list(
                TenantContext.getTenantIdOrDefault(), agentId, enabledOnly));
    }

    @GetMapping("/{toolId}")
    public ApiResponse<ToolResponse> get(@PathVariable String toolId) {
        return ApiResponse.success(toolService.get(TenantContext.getTenantIdOrDefault(), toolId));
    }

    @PutMapping("/{toolId}")
    public ApiResponse<ToolResponse> update(
            @PathVariable String toolId,
            @RequestBody UpdateToolRequest request) {
        return ApiResponse.success(toolService.update(
                TenantContext.getTenantIdOrDefault(), toolId, request));
    }

    @PostMapping("/{toolId}/enable")
    public ApiResponse<ToolResponse> enable(@PathVariable String toolId) {
        return ApiResponse.success(toolService.enable(TenantContext.getTenantIdOrDefault(), toolId));
    }

    @PostMapping("/{toolId}/disable")
    public ApiResponse<ToolResponse> disable(@PathVariable String toolId) {
        return ApiResponse.success(toolService.disable(TenantContext.getTenantIdOrDefault(), toolId));
    }

    @PostMapping("/{toolId}/invoke")
    public ApiResponse<Map<String, Object>> invoke(
            @PathVariable String toolId,
            @RequestBody InvokeToolRequest request) {
        Map<String, Object> input = request.getInput() != null ? request.getInput() : Map.of();
        return ApiResponse.success(toolService.invoke(
                TenantContext.getTenantIdOrDefault(), toolId, input));
    }

    @DeleteMapping("/{toolId}")
    public ApiResponse<Map<String, Object>> delete(@PathVariable String toolId) {
        boolean deleted = toolService.delete(TenantContext.getTenantIdOrDefault(), toolId);
        return ApiResponse.success(Map.of("deleted", deleted, "toolId", toolId));
    }
}
