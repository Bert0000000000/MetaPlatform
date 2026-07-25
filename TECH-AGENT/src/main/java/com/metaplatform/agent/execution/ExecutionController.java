package com.metaplatform.agent.execution;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.common.ApiResponse;
import com.metaplatform.agent.common.TenantContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;

/**
 * Agent 执行端点。
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/agent/agents")
@RequiredArgsConstructor
public class ExecutionController {

    private final ExecutionService executionService;
    private final ObjectMapper objectMapper;

    /**
     * 同步执行 Agent。
     */
    @PostMapping("/{agentId}/execute")
    public ApiResponse<ExecuteResponse> execute(@PathVariable String agentId,
                                                @Valid @RequestBody ExecuteRequest request) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        String traceId = TenantContext.getTraceIdOrGenerate();
        ExecuteResponse result = executionService.execute(tenantId, agentId, request, traceId);
        return ApiResponse.success(result);
    }

    /**
     * SSE 流式执行 Agent。
     *
     * <p>先校验 Agent，使 Agent 不存在 / 未激活异常走全局异常处理器（返回 JSON 错误信封），
     * 避免在 SSE 响应开始后抛异常。</p>
     */
    @PostMapping(value = "/{agentId}/execute/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter executeStream(@PathVariable String agentId,
                                    @Valid @RequestBody ExecuteRequest request) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        String traceId = TenantContext.getTraceIdOrGenerate();

        // 先校验，异常会抛到全局处理器
        executionService.validateAgent(tenantId, agentId);

        SseEmitter emitter = new SseEmitter(0L);
        Thread.startVirtualThread(() -> {
            try {
                List<Map<String, Object>> events = executionService.stream(tenantId, agentId, request, traceId);
                for (Map<String, Object> event : events) {
                    String eventName = strOrEmpty(event.get("event"));
                    Object data = event.get("data");
                    String jsonData = objectMapper.writeValueAsString(data == null ? Map.of() : data);
                    SseEmitter.SseEventBuilder builder = SseEmitter.event()
                            .name(eventName)
                            .data(jsonData);
                    emitter.send(builder);
                }
                emitter.complete();
            } catch (Exception e) {
                log.error("SSE 流式执行失败 | agentId={}", agentId, e);
                emitter.completeWithError(e);
            }
        });
        return emitter;
    }

    private static String strOrEmpty(Object obj) {
        return obj == null ? "" : obj.toString();
    }
}
