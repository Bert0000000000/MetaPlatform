package com.metaplatform.a2a.delegation;

import com.metaplatform.a2a.common.ApiResponse;
import com.metaplatform.a2a.common.PageResponse;
import com.metaplatform.a2a.common.TenantContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * 委派任务端点。
 *
 * <p>对应 Python {@code app.api.v1.delegations}。</p>
 */
@RestController
@RequestMapping("/api/v1/a2a/delegations")
@RequiredArgsConstructor
public class DelegationController {

    private final DelegationService delegationService;

    private final ScheduledExecutorService sseExecutor = Executors.newScheduledThreadPool(2);

    /**
     * 委派任务。
     */
    @PostMapping
    public ApiResponse<Map<String, Object>> delegate(@Valid @RequestBody DelegateTaskRequest request) {
        return ApiResponse.success(delegationService.delegate(
                TenantContext.getTenantIdOrDefault(), request));
    }

    /**
     * 查询任务详情。
     */
    @GetMapping("/{taskId}")
    public ApiResponse<Map<String, Object>> get(@PathVariable String taskId) {
        return ApiResponse.success(delegationService.get(
                TenantContext.getTenantIdOrDefault(), taskId));
    }

    /**
     * 任务列表（分页 + 过滤）。
     */
    @GetMapping
    public ApiResponse<PageResponse<Map<String, Object>>> list(
            @RequestParam(required = false) String sourceAgentId,
            @RequestParam(required = false) String targetAgentId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(delegationService.list(
                TenantContext.getTenantIdOrDefault(),
                sourceAgentId, targetAgentId, status, page, pageSize));
    }

    /**
     * 取消任务。
     */
    @PostMapping("/{taskId}/cancel")
    public ApiResponse<Map<String, Object>> cancel(@PathVariable String taskId) {
        return ApiResponse.success(delegationService.cancel(
                TenantContext.getTenantIdOrDefault(), taskId, TenantContext.getUserId()));
    }

    /**
     * 拉取待执行任务。
     */
    @GetMapping("/pending/{agentId}")
    public ApiResponse<List<Map<String, Object>>> pendingTasks(@PathVariable String agentId) {
        return ApiResponse.success(delegationService.pendingTasks(
                TenantContext.getTenantIdOrDefault(), agentId));
    }

    /**
     * SSE 流式订阅任务状态变更。
     *
     * <p>对应 Python SSE 端点 {@code GET /delegations/{taskId}/stream}。
     * 每 3 秒推送一次当前任务状态，连接保持 5 分钟。</p>
     */
    @GetMapping(value = "/{taskId}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@PathVariable String taskId) {
        SseEmitter emitter = new SseEmitter(300_000L); // 5 分钟超时

        String tenantId = TenantContext.getTenantIdOrDefault();
        sseExecutor.scheduleAtFixedRate(() -> {
            try {
                Map<String, Object> task = delegationService.get(tenantId, taskId);
                emitter.send(SseEmitter.event()
                        .name("task-status")
                        .data(task)
                        .id(String.valueOf(System.currentTimeMillis())));

                // 终态则关闭流
                Object status = task.get("status");
                if (status instanceof String s && isTerminal(s)) {
                    emitter.complete();
                }
            } catch (Exception ex) {
                emitter.completeWithError(ex);
            }
        }, 0, 3, TimeUnit.SECONDS);

        emitter.onCompletion(() -> {});
        emitter.onTimeout(emitter::complete);
        emitter.onError(ex -> emitter.complete());

        return emitter;
    }

    private boolean isTerminal(String status) {
        return "COMPLETED".equals(status) || "FAILED".equals(status)
                || "CANCELED".equals(status) || "CANCELLED".equals(status)
                || "REJECTED".equals(status);
    }
}
