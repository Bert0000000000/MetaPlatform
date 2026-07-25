package com.metaplatform.mcp.debug.controller;

import com.metaplatform.mcp.IamTestConfig;
import org.springframework.context.annotation.Import;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;

import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.debug.dto.BreakpointResponse;
import com.metaplatform.mcp.debug.dto.DebugCompareResponse;
import com.metaplatform.mcp.debug.dto.DebugSessionResponse;
import com.metaplatform.mcp.debug.service.McpDebugService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import(IamTestConfig.class)
@AutoConfigureMockMvc(addFilters = false)
@WebMvcTest(McpDebugController.class)
class McpDebugControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private McpDebugService mcpDebugService;

    private DebugSessionResponse sampleSession() {
        return DebugSessionResponse.builder()
                .id(UUID.randomUUID())
                .serverId(UUID.randomUUID())
                .toolId(UUID.randomUUID())
                .method("tools/call")
                .requestPayload(Map.of("method", "tools/call"))
                .responsePayload(Map.of("content", List.of()))
                .rawRequest("{}")
                .rawResponse("{}")
                .durationMs(15L)
                .status("SUCCESS")
                .breakpoint(false)
                .traceId("trace-1")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    @Test
    void execute_debug() throws Exception {
        when(mcpDebugService.execute(any())).thenReturn(sampleSession());

        mockMvc.perform(post("/api/v1/mcp/debug/execute")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"toolId\":\"" + UUID.randomUUID() + "\",\"requestPayload\":{\"method\":\"tools/call\"}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.status").value("SUCCESS"));
    }

    @Test
    void list_history() throws Exception {
        when(mcpDebugService.history(any(), any()))
                .thenReturn(PageResponse.<DebugSessionResponse>builder()
                        .items(List.of(sampleSession()))
                        .total(1).page(1).size(20).totalPages(1)
                        .build());

        mockMvc.perform(get("/api/v1/mcp/debug/history"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.total").value(1));
    }

    @Test
    void get_session() throws Exception {
        UUID id = UUID.randomUUID();
        DebugSessionResponse response = sampleSession();
        response.setId(id);
        when(mcpDebugService.getSession(id)).thenReturn(response);

        mockMvc.perform(get("/api/v1/mcp/debug/sessions/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(id.toString()));
    }

    @Test
    void replay_session() throws Exception {
        UUID id = UUID.randomUUID();
        when(mcpDebugService.replay(id)).thenReturn(sampleSession());

        mockMvc.perform(post("/api/v1/mcp/debug/sessions/{id}/replay", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUCCESS"));
    }

    @Test
    void compare_sessions() throws Exception {
        UUID left = UUID.randomUUID();
        UUID right = UUID.randomUUID();
        when(mcpDebugService.compare(eq(left), eq(right)))
                .thenReturn(DebugCompareResponse.builder()
                        .left(sampleSession())
                        .right(sampleSession())
                        .differences(List.of("requestPayload"))
                        .build());

        mockMvc.perform(post("/api/v1/mcp/debug/compare")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"leftId\":\"" + left + "\",\"rightId\":\"" + right + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.differences[0]").value("requestPayload"));
    }

    @Test
    void add_breakpoint_returns_breakpoint() throws Exception {
        UUID sessionId = UUID.randomUUID();
        BreakpointResponse bp = BreakpointResponse.builder()
                .id(UUID.randomUUID()).sessionId(sessionId)
                .toolId(UUID.randomUUID()).condition("args.q > 10").enabled(true)
                .createdAt(Instant.now()).updatedAt(Instant.now()).build();
        when(mcpDebugService.addBreakpoint(eq(sessionId), any())).thenReturn(bp);

        mockMvc.perform(post("/api/v1/mcp/debug/sessions/{sessionId}/breakpoints", sessionId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"toolId\":\"" + UUID.randomUUID() + "\",\"condition\":\"args.q > 10\",\"enabled\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.condition").value("args.q > 10"))
                .andExpect(jsonPath("$.data.enabled").value(true));
    }

    @Test
    void remove_breakpoint_returns_success() throws Exception {
        UUID sessionId = UUID.randomUUID();
        UUID breakpointId = UUID.randomUUID();
        doNothing().when(mcpDebugService).removeBreakpoint(sessionId, breakpointId);

        mockMvc.perform(delete("/api/v1/mcp/debug/sessions/{sessionId}/breakpoints/{breakpointId}", sessionId, breakpointId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    void list_breakpoints_returns_list() throws Exception {
        UUID sessionId = UUID.randomUUID();
        BreakpointResponse bp = BreakpointResponse.builder()
                .id(UUID.randomUUID()).sessionId(sessionId)
                .condition("args.q > 5").enabled(true)
                .createdAt(Instant.now()).updatedAt(Instant.now()).build();
        when(mcpDebugService.listBreakpoints(sessionId)).thenReturn(List.of(bp));

        mockMvc.perform(get("/api/v1/mcp/debug/sessions/{sessionId}/breakpoints", sessionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].condition").value("args.q > 5"));
    }
}
