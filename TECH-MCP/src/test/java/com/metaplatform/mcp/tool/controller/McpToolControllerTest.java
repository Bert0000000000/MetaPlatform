package com.metaplatform.mcp.tool.controller;

import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.tool.dto.McpToolListItem;
import com.metaplatform.mcp.tool.dto.McpToolResponse;
import com.metaplatform.mcp.tool.service.McpToolService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(McpToolController.class)
class McpToolControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private McpToolService mcpToolService;

    private McpToolResponse sampleResponse() {
        return McpToolResponse.builder()
                .id(UUID.randomUUID()).name("My Tool").code("my_tool")
                .toolType("HTTP").endpoint("http://x").enabled(true)
                .createdAt(Instant.now()).updatedAt(Instant.now()).build();
    }

    @Test
    void create_tool_returns_200() throws Exception {
        when(mcpToolService.create(any())).thenReturn(sampleResponse());

        mockMvc.perform(post("/api/v1/mcp/tools")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"My Tool\",\"code\":\"my_tool\",\"toolType\":\"HTTP\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.code").value("my_tool"))
                .andExpect(jsonPath("$.data.toolType").value("HTTP"));
    }

    @Test
    void create_tool_invalid_body_returns_400() throws Exception {
        mockMvc.perform(post("/api/v1/mcp/tools")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"toolType\":\"HTTP\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCode.INVALID_PARAM.getCode()));
    }

    @Test
    void get_tool_by_id() throws Exception {
        UUID id = UUID.randomUUID();
        McpToolResponse response = sampleResponse();
        response.setId(id);
        when(mcpToolService.get(id)).thenReturn(response);

        mockMvc.perform(get("/api/v1/mcp/tools/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(id.toString()));
    }

    @Test
    void list_tools_returns_page() throws Exception {
        McpToolListItem item = McpToolListItem.builder()
                .id(UUID.randomUUID()).name("t").code("t").toolType("HTTP").enabled(true).build();
        when(mcpToolService.list(any(), any(), any(), any(), any(), any()))
                .thenReturn(PageResponse.<McpToolListItem>builder()
                        .items(List.of(item)).total(1).page(1).size(20).totalPages(1).build());

        mockMvc.perform(get("/api/v1/mcp/tools")
                        .param("toolType", "HTTP")
                        .param("page", "1")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].code").value("t"))
                .andExpect(jsonPath("$.data.total").value(1));
    }

    @Test
    void enable_tool_returns_enabled() throws Exception {
        UUID id = UUID.randomUUID();
        McpToolResponse response = sampleResponse();
        response.setId(id);
        response.setEnabled(true);
        when(mcpToolService.enable(id)).thenReturn(response);

        mockMvc.perform(post("/api/v1/mcp/tools/{id}/enable", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled").value(true));
    }

    @Test
    void delete_tool_returns_success() throws Exception {
        UUID id = UUID.randomUUID();
        mockMvc.perform(delete("/api/v1/mcp/tools/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    void get_tool_not_found_returns_404() throws Exception {
        UUID id = UUID.randomUUID();
        when(mcpToolService.get(eq(id)))
                .thenThrow(new McpException(ErrorCode.TOOL_NOT_FOUND, "MCP Tool 不存在"));

        mockMvc.perform(get("/api/v1/mcp/tools/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(ErrorCode.TOOL_NOT_FOUND.getCode()));
    }
}
