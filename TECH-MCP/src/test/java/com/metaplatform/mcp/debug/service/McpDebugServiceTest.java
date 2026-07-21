package com.metaplatform.mcp.debug.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.debug.dto.DebugExecuteRequest;
import com.metaplatform.mcp.debug.dto.DebugSessionResponse;
import com.metaplatform.mcp.debug.entity.McpDebugSessionEntity;
import com.metaplatform.mcp.debug.repository.McpDebugSessionRepository;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.jsonrpc.JsonRpcController;
import com.metaplatform.mcp.jsonrpc.JsonRpcResponse;
import com.metaplatform.mcp.server.entity.McpServerEntity;
import com.metaplatform.mcp.server.repository.McpServerRepository;
import com.metaplatform.mcp.tool.entity.McpToolEntity;
import com.metaplatform.mcp.tool.repository.McpToolRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class McpDebugServiceTest {

    @Mock
    private McpDebugSessionRepository debugSessionRepository;
    @Mock
    private McpToolRepository toolRepository;
    @Mock
    private McpServerRepository serverRepository;
    @Mock
    private JsonRpcController jsonRpcController;

    private ObjectMapper objectMapper;
    private McpDebugService mcpDebugService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        mcpDebugService = new McpDebugService(
                debugSessionRepository, toolRepository, serverRepository, jsonRpcController, objectMapper);
    }

    private McpToolEntity tool(UUID id) {
        return McpToolEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .name("tool")
                .code("tool_code")
                .toolType("HTTP")
                .enabled(true)
                .build();
    }

    private McpServerEntity server(UUID id) {
        return McpServerEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .name("server")
                .code("server_code")
                .transportType("SSE")
                .status("ACTIVE")
                .build();
    }

    private McpDebugSessionEntity savedEntity(UUID id) {
        return McpDebugSessionEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .serverId(UUID.randomUUID())
                .toolId(UUID.randomUUID())
                .method("tools/call")
                .requestPayload("{}")
                .rawRequest("{}")
                .responsePayload("{}")
                .rawResponse("{}")
                .durationMs(12L)
                .status("SUCCESS")
                .breakpoint(false)
                .traceId("trace-1")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    @Test
    void execute_tool_success() {
        UUID toolId = UUID.randomUUID();
        DebugExecuteRequest request = new DebugExecuteRequest();
        request.setToolId(toolId);
        request.setRequestPayload(Map.of("jsonrpc", "2.0", "id", 1, "method", "tools/call",
                "params", Map.of("name", "tool_code", "arguments", Map.of("q", 1))));
        request.setBreakpoint(false);

        when(toolRepository.findByIdAndDeletedAtIsNull(toolId)).thenReturn(Optional.of(tool(toolId)));
        when(jsonRpcController.handle(any())).thenReturn(JsonRpcResponse.success(1, Map.of("content", List.of())));
        when(debugSessionRepository.save(any(McpDebugSessionEntity.class))).thenAnswer(inv -> {
            McpDebugSessionEntity e = inv.getArgument(0);
            e.setId(UUID.randomUUID());
            return e;
        });

        DebugSessionResponse response = mcpDebugService.execute(request);

        assertThat(response.getStatus()).isEqualTo("SUCCESS");
        assertThat(response.getMethod()).isEqualTo("tools/call");
        assertThat(response.getBreakpoint()).isFalse();
    }

    @Test
    void execute_with_server_success() {
        UUID serverId = UUID.randomUUID();
        DebugExecuteRequest request = new DebugExecuteRequest();
        request.setServerId(serverId);
        request.setRequestPayload(Map.of("jsonrpc", "2.0", "id", 1, "method", "tools/list"));
        request.setBreakpoint(false);

        when(serverRepository.findByIdAndDeletedAtIsNull(serverId)).thenReturn(Optional.of(server(serverId)));
        when(jsonRpcController.handle(any())).thenReturn(JsonRpcResponse.success(1, Map.of("tools", List.of())));
        when(debugSessionRepository.save(any(McpDebugSessionEntity.class))).thenAnswer(inv -> {
            McpDebugSessionEntity e = inv.getArgument(0);
            e.setId(UUID.randomUUID());
            return e;
        });

        DebugSessionResponse response = mcpDebugService.execute(request);

        assertThat(response.getStatus()).isEqualTo("SUCCESS");
        assertThat(response.getServerId()).isEqualTo(serverId);
    }

    @Test
    void execute_breakpoint_does_not_invoke() {
        UUID toolId = UUID.randomUUID();
        DebugExecuteRequest request = new DebugExecuteRequest();
        request.setToolId(toolId);
        request.setRequestPayload(Map.of("jsonrpc", "2.0", "id", 1, "method", "tools/call"));
        request.setBreakpoint(true);

        when(toolRepository.findByIdAndDeletedAtIsNull(toolId)).thenReturn(Optional.of(tool(toolId)));
        when(debugSessionRepository.save(any(McpDebugSessionEntity.class))).thenAnswer(inv -> {
            McpDebugSessionEntity e = inv.getArgument(0);
            e.setId(UUID.randomUUID());
            return e;
        });

        DebugSessionResponse response = mcpDebugService.execute(request);

        assertThat(response.getStatus()).isEqualTo("BREAKPOINT");
        assertThat(response.getDurationMs()).isNull();
    }

    @Test
    void execute_rpc_error_records_failed_status() {
        UUID toolId = UUID.randomUUID();
        DebugExecuteRequest request = new DebugExecuteRequest();
        request.setToolId(toolId);
        request.setRequestPayload(Map.of("jsonrpc", "2.0", "id", 1, "method", "tools/call"));
        request.setBreakpoint(false);

        when(toolRepository.findByIdAndDeletedAtIsNull(toolId)).thenReturn(Optional.of(tool(toolId)));
        when(jsonRpcController.handle(any())).thenReturn(JsonRpcResponse.error(1, -32602, "Invalid params"));
        when(debugSessionRepository.save(any(McpDebugSessionEntity.class))).thenAnswer(inv -> {
            McpDebugSessionEntity e = inv.getArgument(0);
            e.setId(UUID.randomUUID());
            return e;
        });

        DebugSessionResponse response = mcpDebugService.execute(request);

        assertThat(response.getStatus()).isEqualTo("FAILED");
        assertThat(response.getErrorMessage()).contains("Invalid params");
    }

    @Test
    void history_returns_page() {
        McpDebugSessionEntity entity = savedEntity(UUID.randomUUID());
        Page<McpDebugSessionEntity> page = new PageImpl<>(List.of(entity),
                PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "createdAt")), 1);
        when(debugSessionRepository.findByTenantIdOrderByCreatedAtDesc(eq("tenant-default"), any(PageRequest.class)))
                .thenReturn(page);

        PageResponse<DebugSessionResponse> response = mcpDebugService.history(1, 20);

        assertThat(response.getItems()).hasSize(1);
        assertThat(response.getTotal()).isEqualTo(1);
    }

    @Test
    void get_session_returns_response() {
        UUID id = UUID.randomUUID();
        McpDebugSessionEntity entity = savedEntity(id);
        when(debugSessionRepository.findByIdAndTenantId(id, "tenant-default")).thenReturn(Optional.of(entity));

        DebugSessionResponse response = mcpDebugService.getSession(id);

        assertThat(response.getId()).isEqualTo(id);
        assertThat(response.getStatus()).isEqualTo("SUCCESS");
    }

    @Test
    void get_session_not_found_throws() {
        UUID id = UUID.randomUUID();
        when(debugSessionRepository.findByIdAndTenantId(id, "tenant-default")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> mcpDebugService.getSession(id))
                .isInstanceOf(McpException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.DEBUG_SESSION_NOT_FOUND);
    }

    @Test
    void replay_executes_again() {
        UUID id = UUID.randomUUID();
        McpDebugSessionEntity original = McpDebugSessionEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .toolId(UUID.randomUUID())
                .method("tools/call")
                .requestPayload("{\"method\":\"tools/call\"}")
                .rawRequest("{\"method\":\"tools/call\"}")
                .status("BREAKPOINT")
                .breakpoint(true)
                .traceId("trace-1")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        when(debugSessionRepository.findByIdAndTenantId(id, "tenant-default")).thenReturn(Optional.of(original));
        when(toolRepository.findByIdAndDeletedAtIsNull(original.getToolId())).thenReturn(
                Optional.of(tool(original.getToolId())));
        when(jsonRpcController.handle(any())).thenReturn(JsonRpcResponse.success(1, Map.of("tools", List.of())));
        when(debugSessionRepository.save(any(McpDebugSessionEntity.class))).thenAnswer(inv -> {
            McpDebugSessionEntity e = inv.getArgument(0);
            e.setId(UUID.randomUUID());
            return e;
        });

        DebugSessionResponse response = mcpDebugService.replay(id);

        assertThat(response.getStatus()).isEqualTo("SUCCESS");
        assertThat(response.getBreakpoint()).isFalse();
    }

    @Test
    void compare_returns_differences() {
        UUID leftId = UUID.randomUUID();
        UUID rightId = UUID.randomUUID();
        McpDebugSessionEntity left = McpDebugSessionEntity.builder()
                .id(leftId).tenantId("tenant-default").method("tools/call")
                .requestPayload("{\"a\":1}").responsePayload("{\"r\":1}")
                .status("SUCCESS").durationMs(10L).breakpoint(false).traceId("t1")
                .createdAt(Instant.now()).updatedAt(Instant.now()).build();
        McpDebugSessionEntity right = McpDebugSessionEntity.builder()
                .id(rightId).tenantId("tenant-default").method("tools/list")
                .requestPayload("{\"a\":2}").responsePayload("{\"r\":2}")
                .status("FAILED").durationMs(20L).breakpoint(false).traceId("t2")
                .createdAt(Instant.now()).updatedAt(Instant.now()).build();
        when(debugSessionRepository.findByIdAndTenantId(leftId, "tenant-default")).thenReturn(Optional.of(left));
        when(debugSessionRepository.findByIdAndTenantId(rightId, "tenant-default")).thenReturn(Optional.of(right));

        var result = mcpDebugService.compare(leftId, rightId);

        assertThat(result.getDifferences()).contains("method", "requestPayload", "responsePayload", "status", "durationMs");
    }
}
