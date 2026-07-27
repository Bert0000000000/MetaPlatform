package com.metaplatform.action.orchestration.service;

import com.metaplatform.action.common.TenantContext;
import com.metaplatform.action.common.TraceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * 异步执行编排 DAG 的入口。由于 {@code @Async} 切换线程，
 * 而 {@link TenantContext}/{@link TraceContext} 基于 ThreadLocal，
 * 调用方必须显式传入 tenantId 与 traceId，由本类在新线程中重建上下文。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrchestrationAsyncRunner {

    private final OrchestrationExecutionService orchestrationExecutionService;

    @Async
    public void run(String executionId, String tenantId, String traceId) {
        try {
            if (tenantId != null && !tenantId.isBlank()) {
                TenantContext.set(tenantId);
            }
            if (traceId != null && !traceId.isBlank()) {
                TraceContext.set(traceId);
            }
            orchestrationExecutionService.processExecution(executionId);
        } catch (Exception e) {
            log.error("Async orchestration execution {} failed", executionId, e);
        } finally {
            TenantContext.clear();
            TraceContext.clear();
        }
    }
}
