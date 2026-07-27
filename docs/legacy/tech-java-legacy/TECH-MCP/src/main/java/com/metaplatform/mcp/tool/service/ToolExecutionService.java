package com.metaplatform.mcp.tool.service;

import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.common.TraceContext;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.tool.dto.BatchExecutionItemResponse;
import com.metaplatform.mcp.tool.dto.BatchExecutionRequest;
import com.metaplatform.mcp.tool.dto.ToolExecutionResponse;
import com.metaplatform.mcp.tool.entity.McpBatchExecutionEntity;
import com.metaplatform.mcp.tool.entity.McpToolEntity;
import com.metaplatform.mcp.tool.entity.McpToolExecutionEntity;
import com.metaplatform.mcp.tool.repository.McpBatchExecutionRepository;
import com.metaplatform.mcp.tool.repository.McpToolExecutionRepository;
import com.metaplatform.mcp.tool.repository.McpToolRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ToolExecutionService {

    private final McpToolRepository mcpToolRepository;
    private final McpToolExecutionRepository executionRepository;
    private final McpBatchExecutionRepository batchRepository;
    private final ToolExecutorEngine engine;
    private final AsyncExecutionRunner asyncExecutionRunner;

    @Transactional
    public ToolExecutionResponse executeTool(UUID toolId, String input) {
        McpToolEntity tool = findTool(toolId);
        String tenantId = TenantContext.getOrDefault();
        String traceId = TraceContext.getOrCreate();
        Instant started = Instant.now();
        McpToolExecutionEntity exec = McpToolExecutionEntity.builder()
                .tenantId(tenantId)
                .toolId(toolId)
                .input(input)
                .status("RUNNING")
                .traceId(traceId)
                .startedAt(started)
                .createdAt(started)
                .updatedAt(started)
                .build();
        exec = executionRepository.save(exec);
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
        McpToolExecutionEntity saved = executionRepository.save(exec);
        return toResponse(saved);
    }

    @Transactional
    public UUID asyncExecute(UUID toolId, String input) {
        McpToolEntity tool = findTool(toolId);
        String tenantId = TenantContext.getOrDefault();
        String traceId = TraceContext.getOrCreate();
        Instant now = Instant.now();
        McpToolExecutionEntity exec = McpToolExecutionEntity.builder()
                .tenantId(tenantId)
                .toolId(toolId)
                .input(input)
                .status("RUNNING")
                .traceId(traceId)
                .startedAt(now)
                .createdAt(now)
                .updatedAt(now)
                .build();
        exec = executionRepository.save(exec);
        UUID execId = exec.getId();
        submitAfterCommit(() -> asyncExecutionRunner.runToolExecution(execId, tool, input, tenantId, traceId));
        return execId;
    }

    @Transactional
    public String batchExecute(List<BatchExecutionRequest.BatchItem> items) {
        String tenantId = TenantContext.getOrDefault();
        String traceId = TraceContext.getOrCreate();
        String batchId = UUID.randomUUID().toString();
        Instant now = Instant.now();
        for (BatchExecutionRequest.BatchItem item : items) {
            McpToolEntity tool = findTool(item.getToolId());
            McpBatchExecutionEntity batch = McpBatchExecutionEntity.builder()
                    .tenantId(tenantId)
                    .batchId(batchId)
                    .toolId(item.getToolId())
                    .input(item.getInput())
                    .status("PENDING")
                    .startedAt(now)
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
            batch = batchRepository.save(batch);
            UUID itemId = batch.getId();
            String input = item.getInput();
            submitAfterCommit(() -> asyncExecutionRunner.runBatchItem(itemId, tool, input, tenantId, traceId));
        }
        return batchId;
    }

    @Transactional(readOnly = true)
    public ToolExecutionResponse getExecution(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        McpToolExecutionEntity exec = executionRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new McpException(ErrorCode.EXECUTION_NOT_FOUND, "执行记录不存在"));
        return toResponse(exec);
    }

    @Transactional(readOnly = true)
    public List<BatchExecutionItemResponse> getBatchExecutions(String batchId) {
        String tenantId = TenantContext.getOrDefault();
        return batchRepository.findByTenantIdAndBatchId(tenantId, batchId).stream()
                .map(this::toBatchItemResponse)
                .toList();
    }

    McpToolEntity findTool(UUID toolId) {
        String tenantId = TenantContext.getOrDefault();
        return mcpToolRepository.findByIdAndDeletedAtIsNull(toolId)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new McpException(ErrorCode.TOOL_NOT_FOUND, "MCP Tool 不存在"));
    }

    /**
     * Defers async submission until the current transaction commits, so the freshly
     * inserted execution record is visible to the async thread. Falls back to running
     * inline when no transaction synchronization is active (e.g. unit tests).
     */
    private void submitAfterCommit(Runnable task) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    task.run();
                }
            });
        } else {
            task.run();
        }
    }

    private ToolExecutionResponse toResponse(McpToolExecutionEntity entity) {
        return ToolExecutionResponse.builder()
                .id(entity.getId())
                .toolId(entity.getToolId())
                .status(entity.getStatus())
                .output(entity.getOutput())
                .errorMessage(entity.getErrorMessage())
                .durationMs(entity.getDurationMs())
                .traceId(entity.getTraceId())
                .startedAt(entity.getStartedAt())
                .completedAt(entity.getCompletedAt())
                .createdAt(entity.getCreatedAt())
                .build();
    }

    private BatchExecutionItemResponse toBatchItemResponse(McpBatchExecutionEntity entity) {
        return BatchExecutionItemResponse.builder()
                .id(entity.getId())
                .batchId(entity.getBatchId())
                .toolId(entity.getToolId())
                .status(entity.getStatus())
                .output(entity.getOutput())
                .errorMessage(entity.getErrorMessage())
                .startedAt(entity.getStartedAt())
                .completedAt(entity.getCompletedAt())
                .build();
    }
}
