package com.metaplatform.a2a.inbound;

import com.metaplatform.a2a.common.ApiResponse;
import com.metaplatform.a2a.common.ErrorCode;
import com.metaplatform.a2a.common.TenantContext;
import com.metaplatform.a2a.entity.AgentCardEntity;
import com.metaplatform.a2a.exception.A2aException;
import com.metaplatform.a2a.repository.AgentCardRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * 语义化 A2A Agent 调用入口。
 *
 * <p>PRD 要求 {@code /api/v1/a2a/agents/{agentId}/invoke} 作为语义化别名端点，
 * 内部转发到现有的 {@code /api/v1/a2a/inbound/tasks/send} 逻辑。</p>
 */
@RestController
@RequestMapping("/api/v1/a2a/agents")
@RequiredArgsConstructor
public class InvokeController {

    private final InboundTaskService inboundTaskService;
    private final AgentCardRepository agentCardRepository;

    /**
     * 语义化调用 Agent。
     *
     * <p>POST /api/v1/a2a/agents/{agentId}/invoke</p>
     * <p>请求体：{@code { input: {...}, pageContext: {...}, streaming: false }}</p>
     * <p>内部构造 tasks/send 请求并调用 {@link InboundTaskService#handleSend}。</p>
     *
     * @param agentId 目标 Agent ID
     * @param request 调用请求体
     * @return 任务执行结果
     */
    @PostMapping("/{agentId}/invoke")
    public ApiResponse<Map<String, Object>> invoke(
            @PathVariable String agentId,
            @RequestBody InvokeRequest request) {

        validateAgent(agentId);

        Map<String, Object> payload = new LinkedHashMap<>();
        if (request.getInput() != null) {
            payload.put("input", request.getInput());
        }
        if (request.getPageContext() != null) {
            payload.put("pageContext", request.getPageContext());
        }
        if (Boolean.TRUE.equals(request.getStreaming())) {
            payload.put("streaming", true);
        }

        String jsonrpcId = UUID.randomUUID().toString().replace("-", "");
        Map<String, Object> result = inboundTaskService.handleSend(
                TenantContext.getTenantIdOrDefault(),
                null,
                agentId,
                jsonrpcId,
                payload);

        return ApiResponse.success(result);
    }

    /**
     * 查询调用状态。
     *
     * <p>GET /api/v1/a2a/agents/{agentId}/invoke/{taskId}/status</p>
     * <p>内部调用 {@link InboundTaskService#handleGet} 查询任务状态。</p>
     *
     * @param agentId 目标 Agent ID
     * @param taskId  任务 ID
     * @return 任务状态信息
     */
    @GetMapping("/{agentId}/invoke/{taskId}/status")
    public ApiResponse<Map<String, Object>> getInvokeStatus(
            @PathVariable String agentId,
            @PathVariable String taskId) {

        validateAgent(agentId);

        Map<String, Object> result = inboundTaskService.handleGet(
                TenantContext.getTenantIdOrDefault(),
                taskId,
                null);

        return ApiResponse.success(result);
    }

    private void validateAgent(String agentId) {
        agentCardRepository.findByIdAndTenantId(agentId, TenantContext.getTenantIdOrDefault())
                .orElseThrow(() -> A2aException.agentNotFound(agentId));
    }
}
