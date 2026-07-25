package com.metaplatform.a2a.messaging;

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

import java.util.List;
import java.util.Map;

/**
 * Agent 间消息端点。
 *
 * <p>对应 Python {@code app.api.v1.messages}。</p>
 */
@RestController
@RequestMapping("/api/v1/a2a/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;

    @PostMapping
    public ApiResponse<Map<String, Object>> send(@Valid @RequestBody SendMessageRequest request) {
        return ApiResponse.success(messageService.send(
                TenantContext.getTenantIdOrDefault(), request));
    }

    @GetMapping("/{messageId}")
    public ApiResponse<Map<String, Object>> get(@PathVariable String messageId) {
        return ApiResponse.success(messageService.get(
                TenantContext.getTenantIdOrDefault(), messageId));
    }

    @GetMapping("/inbox/{agentId}")
    public ApiResponse<PageResponse<Map<String, Object>>> inbox(
            @PathVariable String agentId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(messageService.inbox(
                TenantContext.getTenantIdOrDefault(), agentId, page, pageSize));
    }

    @GetMapping("/outbox/{agentId}")
    public ApiResponse<PageResponse<Map<String, Object>>> outbox(
            @PathVariable String agentId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(messageService.outbox(
                TenantContext.getTenantIdOrDefault(), agentId, page, pageSize));
    }

    @PostMapping("/{messageId}/ack")
    public ApiResponse<Map<String, Object>> acknowledge(@PathVariable String messageId) {
        boolean ok = messageService.acknowledge(
                TenantContext.getTenantIdOrDefault(), messageId, TenantContext.getUserId());
        return ApiResponse.success(Map.of("acknowledged", ok, "messageId", messageId));
    }

    @GetMapping("/queue/{agentId}")
    public ApiResponse<List<Map<String, Object>>> queue(@PathVariable String agentId) {
        return ApiResponse.success(messageService.queue(
                TenantContext.getTenantIdOrDefault(), agentId));
    }

    @PostMapping("/cleanup-expired")
    public ApiResponse<Map<String, Object>> cleanupExpired() {
        return ApiResponse.success(messageService.cleanupExpired(
                TenantContext.getTenantIdOrDefault()));
    }
}
