package com.metaplatform.mcp.client.controller;

import com.metaplatform.mcp.client.dto.McpClientResponse;
import com.metaplatform.mcp.client.service.McpClientService;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.tool.dto.McpToolListItem;
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
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(McpClientController.class)
class McpClientControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private McpClientService mcpClientService;

    private McpClientResponse sampleResponse() {
        return McpClientResponse.builder()
                .id(UUID.randomUUID()).name("client").serverUrl("http://x")
                .transportType("HTTP").status("DISCONNECTED").config("{}")
                .createdAt(Instant.now()).updatedAt(Instant.now()).build();
    }

    @Test
    void create_client_returns_200() throws Exception {
        when(mcpClientService.create(any())).thenReturn(sampleResponse());

        mockMvc.perform(post("/api/v1/mcp/clients")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"client\",\"serverUrl\":\"http://x\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("client"));
    }

    @Test
    void get_client_by_id() throws Exception {
        UUID id = UUID.randomUUID();
        McpClientResponse response = sampleResponse();
        response.setId(id);
        when(mcpClientService.get(id)).thenReturn(response);

        mockMvc.perform(get("/api/v1/mcp/clients/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(id.toString()));
    }

    @Test
    void list_clients_returns_page() throws Exception {
        when(mcpClientService.list(any(), any(), any(), any()))
                .thenReturn(PageResponse.<McpClientResponse>builder()
                        .items(List.of(sampleResponse())).total(1).page(1).size(20).totalPages(1).build());

        mockMvc.perform(get("/api/v1/mcp/clients").param("page", "1").param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1));
    }

    @Test
    void test_connection_returns_updated_client() throws Exception {
        UUID id = UUID.randomUUID();
        McpClientResponse response = sampleResponse();
        response.setId(id);
        response.setStatus("CONNECTED");
        when(mcpClientService.testConnection(id)).thenReturn(response);

        mockMvc.perform(post("/api/v1/mcp/clients/{id}/test", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CONNECTED"));
    }

    @Test
    void get_status_returns_map() throws Exception {
        UUID id = UUID.randomUUID();
        when(mcpClientService.getStatus(id))
                .thenReturn(Map.of("id", id, "status", "CONNECTED", "connected", true));

        mockMvc.perform(get("/api/v1/mcp/clients/{id}/status", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CONNECTED"))
                .andExpect(jsonPath("$.data.connected").value(true));
    }

    @Test
    void discover_tools_returns_list() throws Exception {
        UUID id = UUID.randomUUID();
        McpToolListItem item = McpToolListItem.builder()
                .id(UUID.randomUUID()).name("rt").code("remote_tool").toolType("MCP").enabled(true).build();
        when(mcpClientService.discoverTools(id)).thenReturn(List.of(item));

        mockMvc.perform(post("/api/v1/mcp/clients/{id}/discover", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].code").value("remote_tool"))
                .andExpect(jsonPath("$.data[0].toolType").value("MCP"));
    }

    @Test
    void get_discovered_tools_returns_list() throws Exception {
        UUID id = UUID.randomUUID();
        McpToolListItem item = McpToolListItem.builder()
                .id(UUID.randomUUID()).name("rt").code("remote_tool").toolType("MCP").enabled(true).build();
        when(mcpClientService.getDiscoveredTools(id)).thenReturn(List.of(item));

        mockMvc.perform(get("/api/v1/mcp/clients/{id}/discovered-tools", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].code").value("remote_tool"));
    }

    @Test
    void get_client_not_found_returns_404() throws Exception {
        UUID id = UUID.randomUUID();
        when(mcpClientService.get(eq(id)))
                .thenThrow(new McpException(ErrorCode.CLIENT_NOT_FOUND, "MCP Client 不存在"));

        mockMvc.perform(get("/api/v1/mcp/clients/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(ErrorCode.CLIENT_NOT_FOUND.getCode()));
    }

    @Test
    void test_connection_alias_returns_updated_client() throws Exception {
        UUID id = UUID.randomUUID();
        McpClientResponse response = sampleResponse();
        response.setId(id);
        response.setStatus("CONNECTED");
        when(mcpClientService.testConnection(id)).thenReturn(response);

        mockMvc.perform(post("/api/v1/mcp/clients/{id}/test-connection", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CONNECTED"));
    }

    @Test
    void get_tools_returns_list() throws Exception {
        UUID id = UUID.randomUUID();
        McpToolListItem item = McpToolListItem.builder()
                .id(UUID.randomUUID()).name("rt").code("remote_tool").toolType("MCP").enabled(true).build();
        when(mcpClientService.getTools(id)).thenReturn(List.of(item));

        mockMvc.perform(get("/api/v1/mcp/clients/{id}/tools", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].code").value("remote_tool"));
    }
}
