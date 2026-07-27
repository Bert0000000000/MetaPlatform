package com.metaplatform.mcp.tool.service;

import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.tool.dto.BatchExecutionItemResponse;
import com.metaplatform.mcp.tool.dto.BatchExecutionRequest;
import com.metaplatform.mcp.tool.dto.ToolExecutionResponse;
import com.metaplatform.mcp.tool.entity.McpToolEntity;
import com.metaplatform.mcp.tool.entity.McpToolExecutionEntity;
import com.metaplatform.mcp.tool.repository.McpBatchExecutionRepository;
import com.metaplatform.mcp.tool.repository.McpToolExecutionRepository;
import com.metaplatform.mcp.tool.repository.McpToolRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ToolExecutionServiceTest {

    @Mock
    private McpToolRepository mcpToolRepository;
    @Mock
    private McpToolExecutionRepository executionRepository;
    @Mock
    private McpBatchExecutionRepository batchRepository;
    @Mock
    private ToolExecutorEngine engine;
    @Mock
    private AsyncExecutionRunner asyncExecutionRunner;

    private ToolExecutionService toolExecutionService;

    @BeforeEach
    void setUp() {
        toolExecutionService = new ToolExecutionService(
                mcpToolRepository, executionRepository, batchRepository, engine, asyncExecutionRunner);
    }

    private McpToolEntity tool(String toolType, String endpoint) {
        return McpToolEntity.builder()
                .id(UUID.randomUUID())
                .tenantId("tenant-default")
                .name("tool")
                .code("tool_code")
                .toolType(toolType)
                .endpoint(endpoint)
                .enabled(true)
                .build();
    }

    @Test
    void execute_tool_http_success() {
        UUID toolId = UUID.randomUUID();
        McpToolEntity tool = tool("HTTP", "http://example.com");
        when(mcpToolRepository.findByIdAndDeletedAtIsNull(toolId)).thenReturn(Optional.of(tool));
        when(engine.doExecute(tool, "{\"q\":1}")).thenReturn("http-output");
        when(executionRepository.save(any(McpToolExecutionEntity.class))).thenAnswer(inv -> {
            McpToolExecutionEntity e = inv.getArgument(0);
            if (e.getId() == null) {
                e.setId(UUID.randomUUID());
            }
            return e;
        });

        ToolExecutionResponse response = toolExecutionService.executeTool(toolId, "{\"q\":1}");

        assertThat(response.getStatus()).isEqualTo("SUCCESS");
        assertThat(response.getOutput()).isEqualTo("http-output");
        assertThat(response.getDurationMs()).isNotNull();
    }

    @Test
    void execute_tool_bean_success() {
        UUID toolId = UUID.randomUUID();
        McpToolEntity tool = tool("BEAN", null);
        tool.setBeanClass("com.example.MyExecutor");
        when(mcpToolRepository.findByIdAndDeletedAtIsNull(toolId)).thenReturn(Optional.of(tool));
        when(engine.doExecute(eq(tool), anyString())).thenReturn("bean-output");
        when(executionRepository.save(any(McpToolExecutionEntity.class))).thenAnswer(inv -> {
            McpToolExecutionEntity e = inv.getArgument(0);
            if (e.getId() == null) {
                e.setId(UUID.randomUUID());
            }
            return e;
        });

        ToolExecutionResponse response = toolExecutionService.executeTool(toolId, "{}");

        assertThat(response.getStatus()).isEqualTo("SUCCESS");
        assertThat(response.getOutput()).isEqualTo("bean-output");
    }

    @Test
    void execute_tool_failure_records_failed_status() {
        UUID toolId = UUID.randomUUID();
        McpToolEntity tool = tool("HTTP", "http://example.com");
        when(mcpToolRepository.findByIdAndDeletedAtIsNull(toolId)).thenReturn(Optional.of(tool));
        when(engine.doExecute(any(), anyString())).thenThrow(new McpException(ErrorCode.TOOL_EXECUTION_ERROR, "boom"));
        when(executionRepository.save(any(McpToolExecutionEntity.class))).thenAnswer(inv -> {
            McpToolExecutionEntity e = inv.getArgument(0);
            if (e.getId() == null) {
                e.setId(UUID.randomUUID());
            }
            return e;
        });

        ToolExecutionResponse response = toolExecutionService.executeTool(toolId, "{}");

        assertThat(response.getStatus()).isEqualTo("FAILED");
        assertThat(response.getErrorMessage()).contains("boom");
    }

    @Test
    void execute_tool_not_found_throws() {
        UUID toolId = UUID.randomUUID();
        when(mcpToolRepository.findByIdAndDeletedAtIsNull(toolId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> toolExecutionService.executeTool(toolId, "{}"))
                .isInstanceOf(McpException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.TOOL_NOT_FOUND);
    }

    @Test
    void async_execute_returns_id_and_submits_runner() {
        UUID toolId = UUID.randomUUID();
        McpToolEntity tool = tool("HTTP", "http://example.com");
        UUID execId = UUID.randomUUID();
        when(mcpToolRepository.findByIdAndDeletedAtIsNull(toolId)).thenReturn(Optional.of(tool));
        when(executionRepository.save(any(McpToolExecutionEntity.class))).thenAnswer(inv -> {
            McpToolExecutionEntity e = inv.getArgument(0);
            e.setId(execId);
            return e;
        });

        UUID returned = toolExecutionService.asyncExecute(toolId, "{\"q\":1}");

        assertThat(returned).isEqualTo(execId);
        verify(asyncExecutionRunner).runToolExecution(eq(execId), eq(tool), eq("{\"q\":1}"), anyString(), anyString());
    }

    @Test
    void batch_execute_returns_batch_id_and_submits_all() {
        UUID toolId1 = UUID.randomUUID();
        UUID toolId2 = UUID.randomUUID();
        McpToolEntity tool1 = tool("HTTP", "http://a");
        McpToolEntity tool2 = tool("BEAN", null);
        when(mcpToolRepository.findByIdAndDeletedAtIsNull(toolId1)).thenReturn(Optional.of(tool1));
        when(mcpToolRepository.findByIdAndDeletedAtIsNull(toolId2)).thenReturn(Optional.of(tool2));
        when(batchRepository.save(any())).thenAnswer(inv -> {
            com.metaplatform.mcp.tool.entity.McpBatchExecutionEntity e = inv.getArgument(0);
            e.setId(UUID.randomUUID());
            return e;
        });

        BatchExecutionRequest.BatchItem item1 = new BatchExecutionRequest.BatchItem();
        item1.setToolId(toolId1);
        item1.setInput("{\"a\":1}");
        BatchExecutionRequest.BatchItem item2 = new BatchExecutionRequest.BatchItem();
        item2.setToolId(toolId2);
        item2.setInput("{\"b\":2}");

        String batchId = toolExecutionService.batchExecute(List.of(item1, item2));

        assertThat(batchId).isNotBlank();
        verify(asyncExecutionRunner, times(2)).runBatchItem(any(), any(), anyString(), anyString(), anyString());
    }

    @Test
    void get_execution_returns_response() {
        UUID execId = UUID.randomUUID();
        McpToolExecutionEntity entity = McpToolExecutionEntity.builder()
                .id(execId).tenantId("tenant-default").toolId(UUID.randomUUID())
                .status("SUCCESS").output("out").traceId("t").durationMs(10L)
                .createdAt(Instant.now()).updatedAt(Instant.now()).build();
        when(executionRepository.findByIdAndTenantId(execId, "tenant-default")).thenReturn(Optional.of(entity));

        ToolExecutionResponse response = toolExecutionService.getExecution(execId);

        assertThat(response.getStatus()).isEqualTo("SUCCESS");
        assertThat(response.getOutput()).isEqualTo("out");
    }

    @Test
    void get_batch_executions_returns_items() {
        String batchId = "batch-123";
        com.metaplatform.mcp.tool.entity.McpBatchExecutionEntity item =
                com.metaplatform.mcp.tool.entity.McpBatchExecutionEntity.builder()
                        .id(UUID.randomUUID()).tenantId("tenant-default").batchId(batchId)
                        .toolId(UUID.randomUUID()).status("SUCCESS").output("o").build();
        when(batchRepository.findByTenantIdAndBatchId("tenant-default", batchId)).thenReturn(List.of(item));

        List<BatchExecutionItemResponse> items = toolExecutionService.getBatchExecutions(batchId);

        assertThat(items).hasSize(1);
        assertThat(items.get(0).getBatchId()).isEqualTo(batchId);
        assertThat(items.get(0).getStatus()).isEqualTo("SUCCESS");
    }
}
