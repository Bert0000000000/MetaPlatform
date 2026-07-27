package com.metaplatform.agent.agents;

import com.metaplatform.agent.agents.dto.AgentOperationLogResponse;
import com.metaplatform.agent.agents.dto.AgentResponse;
import com.metaplatform.agent.agents.dto.AgentVersionResponse;
import com.metaplatform.agent.agents.dto.CloneAgentRequest;
import com.metaplatform.agent.agents.dto.CreateAgentRequest;
import com.metaplatform.agent.agents.dto.UpdateAgentRequest;
import com.metaplatform.agent.common.ApiResponse;
import com.metaplatform.agent.common.PageResponse;
import com.metaplatform.agent.common.TenantContext;
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

import java.util.Map;

/**
 * Agent 定义 CRUD 端点。
 *
 * <p>对应 Python {@code app.api.v1.agents}。</p>
 */
@RestController
@RequestMapping("/api/v1/agent/agents")
@RequiredArgsConstructor
public class AgentController {

    private final AgentService agentService;

    @PostMapping
    public ApiResponse<AgentResponse> create(@Valid @RequestBody CreateAgentRequest request) {
        AgentResponse response = agentService.create(
                TenantContext.getTenantIdOrDefault(), request, TenantContext.getUserId());
        return ApiResponse.success(response);
    }

    @GetMapping
    public ApiResponse<PageResponse<AgentResponse>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        PageResponse<AgentResponse> result = agentService.list(
                TenantContext.getTenantIdOrDefault(), status, page, pageSize);
        return ApiResponse.success(result);
    }

    @GetMapping("/{agentId}")
    public ApiResponse<AgentResponse> get(@PathVariable String agentId) {
        AgentResponse response = agentService.get(TenantContext.getTenantIdOrDefault(), agentId);
        return ApiResponse.success(response);
    }

    @PutMapping("/{agentId}")
    public ApiResponse<AgentResponse> update(
            @PathVariable String agentId,
            @Valid @RequestBody UpdateAgentRequest request) {
        AgentResponse response = agentService.update(
                TenantContext.getTenantIdOrDefault(), agentId, request, TenantContext.getUserId());
        return ApiResponse.success(response);
    }

    @PostMapping("/{agentId}/clone")
    public ApiResponse<AgentResponse> clone(
            @PathVariable String agentId,
            @Valid @RequestBody CloneAgentRequest request) {
        AgentResponse response = agentService.clone(
                TenantContext.getTenantIdOrDefault(), agentId, request, TenantContext.getUserId());
        return ApiResponse.success(response);
    }

    @DeleteMapping("/{agentId}")
    public ApiResponse<Map<String, Object>> delete(@PathVariable String agentId) {
        boolean ok = agentService.delete(
                TenantContext.getTenantIdOrDefault(), agentId, TenantContext.getUserId());
        return ApiResponse.success(Map.of("deleted", ok, "agentId", agentId));
    }

    @GetMapping("/{agentId}/versions")
    public ApiResponse<PageResponse<AgentVersionResponse>> listVersions(
            @PathVariable String agentId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        PageResponse<AgentVersionResponse> result = agentService.listVersions(
                TenantContext.getTenantIdOrDefault(), agentId, page, pageSize);
        return ApiResponse.success(result);
    }

    @GetMapping("/{agentId}/logs")
    public ApiResponse<PageResponse<AgentOperationLogResponse>> listLogs(
            @PathVariable String agentId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        PageResponse<AgentOperationLogResponse> result = agentService.listLogs(
                TenantContext.getTenantIdOrDefault(), agentId, page, pageSize);
        return ApiResponse.success(result);
    }
}
