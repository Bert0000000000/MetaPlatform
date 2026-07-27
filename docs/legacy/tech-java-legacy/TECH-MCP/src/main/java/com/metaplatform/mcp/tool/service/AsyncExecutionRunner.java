package com.metaplatform.mcp.tool.service;

import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.common.TraceContext;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.tool.entity.McpBatchExecutionEntity;
import com.metaplatform.mcp.tool.entity.McpToolEntity;
import com.metaplatform.mcp.tool.entity.McpToolExecutionEntity;
import com.metaplatform.mcp.tool.repository.McpBatchExecutionRepository;
import com.metaplatform.mcp.tool.repository.McpToolExecutionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Runs tool executions asynchronously. Methods are {@code @Async @Transactional} so that
 * they execute on a managed thread pool and persist results in their own transaction.
 * The creating transaction commits before these are invoked (see after-commit guard in
 * {@link ToolExecutionService}), so the freshly inserted records are visible here.
 */
@Component
@RequiredArgsConstructor
public class AsyncExecutionRunner {

    private final ToolExecutorEngine engine;
    private final McpToolExecutionRepository executionRepository;
    private final McpBatchExecutionRepository batchRepository;

    @Async
    @Transactional
    public void runToolExecution(UUID execId, McpToolEntity tool, String input,
                                 String tenantId, String traceId) {
        TenantContext.set(tenantId);
        TraceContext.set(traceId);
        try {
            McpToolExecutionEntity exec = executionRepository.findById(execId)
                    .orElseThrow(() -> new McpException(ErrorCode.EXECUTION_NOT_FOUND, "执行记录不存在"));
            Instant started = exec.getStartedAt() != null ? exec.getStartedAt() : Instant.now();
            try {
                exec.setOutput(engine.doExecute(tool, input));
                exec.setStatus("SUCCESS");
            } catch (Exception e) {
                exec.setStatus("FAILED");
                exec.setErrorMessage(e.getMessage());
            }
            Instant completed = Instant.now();
            exec.setCompletedAt(completed);
            exec.setDurationMs(Duration.between(started, completed).toMillis());
            exec.setUpdatedAt(completed);
            executionRepository.save(exec);
        } finally {
            TenantContext.clear();
            TraceContext.clear();
        }
    }

    @Async
    @Transactional
    public void runBatchItem(UUID itemId, McpToolEntity tool, String input,
                             String tenantId, String traceId) {
        TenantContext.set(tenantId);
        TraceContext.set(traceId);
        try {
            McpBatchExecutionEntity item = batchRepository.findById(itemId)
                    .orElseThrow(() -> new McpException(ErrorCode.EXECUTION_NOT_FOUND, "批量执行记录不存在"));
            Instant started = item.getStartedAt() != null ? item.getStartedAt() : Instant.now();
            try {
                item.setOutput(engine.doExecute(tool, input));
                item.setStatus("SUCCESS");
            } catch (Exception e) {
                item.setStatus("FAILED");
                item.setErrorMessage(e.getMessage());
            }
            Instant completed = Instant.now();
            item.setCompletedAt(completed);
            item.setUpdatedAt(completed);
            batchRepository.save(item);
        } finally {
            TenantContext.clear();
            TraceContext.clear();
        }
    }
}
