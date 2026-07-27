package com.metaplatform.agent.conversations;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.common.ApiResponse;
import com.metaplatform.agent.common.PageResponse;
import com.metaplatform.agent.common.TenantContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;

/**
 * 对话管理端点。
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/agent/conversations")
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationService conversationService;
    private final ObjectMapper objectMapper;

    /**
     * 创建会话。
     */
    @PostMapping
    public ApiResponse<ConversationResponse> create(@Valid @RequestBody CreateConversationRequest request) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        ConversationResponse conv = conversationService.create(
                tenantId, request.getAgentId(), request.getTitle(), request.getMode());
        return ApiResponse.success(conv);
    }

    /**
     * 会话列表（分页）。
     */
    @GetMapping
    public ApiResponse<PageResponse<ConversationResponse>> list(
            @RequestParam(required = false) String agentId,
            @RequestParam(required = false) Boolean favorite,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        var pageResult = conversationService.list(tenantId, agentId, favorite, page, pageSize);
        return ApiResponse.success(PageResponse.of(pageResult));
    }

    /**
     * 切换会话收藏状态。
     */
    @PostMapping("/{conversationId}/favorite")
    public ApiResponse<ConversationResponse> toggleFavorite(@PathVariable String conversationId) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return ApiResponse.success(conversationService.toggleFavorite(tenantId, conversationId));
    }

    /**
     * 会话详情。
     */
    @GetMapping("/{conversationId}")
    public ApiResponse<ConversationResponse> get(@PathVariable String conversationId) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return ApiResponse.success(conversationService.get(tenantId, conversationId));
    }

    /**
     * 发送消息（同步）。
     */
    @PostMapping("/{conversationId}/messages")
    public ApiResponse<MessageResponse> sendMessage(@PathVariable String conversationId,
                                                    @Valid @RequestBody SendMessageRequest request) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        String traceId = TenantContext.getTraceIdOrGenerate();
        MessageResponse msg = conversationService.sendMessage(tenantId, conversationId, request, traceId);
        return ApiResponse.success(msg);
    }

    /**
     * 发送消息（流式）。
     */
    @PostMapping(value = "/{conversationId}/messages/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamMessage(@PathVariable String conversationId,
                                    @Valid @RequestBody SendMessageRequest request) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        String traceId = TenantContext.getTraceIdOrGenerate();

        SseEmitter emitter = new SseEmitter(0L);
        Thread.startVirtualThread(() -> {
            try {
                List<Map<String, Object>> events = conversationService.streamMessage(
                        tenantId, conversationId, request, traceId);
                for (Map<String, Object> event : events) {
                    String eventName = event.get("event") == null ? "" : event.get("event").toString();
                    Object data = event.get("data");
                    String jsonData = objectMapper.writeValueAsString(data == null ? Map.of() : data);
                    emitter.send(SseEmitter.event().name(eventName).data(jsonData));
                }
                emitter.complete();
            } catch (Exception e) {
                log.error("SSE 流式消息失败 | conversationId={}", conversationId, e);
                emitter.completeWithError(e);
            }
        });
        return emitter;
    }

    /**
     * 会话消息历史。
     */
    @GetMapping("/{conversationId}/messages")
    public ApiResponse<PageResponse<MessageResponse>> getHistory(
            @PathVariable String conversationId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int pageSize) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        var pageResult = conversationService.getHistory(tenantId, conversationId, page, pageSize);
        return ApiResponse.success(PageResponse.of(pageResult));
    }

    /**
     * 结束会话。
     */
    @PostMapping("/{conversationId}/end")
    public ApiResponse<ConversationResponse> endConversation(@PathVariable String conversationId) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return ApiResponse.success(conversationService.endConversation(tenantId, conversationId));
    }
}
