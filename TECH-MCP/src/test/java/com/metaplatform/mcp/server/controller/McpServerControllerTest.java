package com.metaplatform.mcp.server.controller;

import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.server.dto.ConnectionStatusResponse;
import com.metaplatform.mcp.server.dto.IdeConfigResponse;
import com.metaplatform.mcp.server.dto.McpServerListItem;
import com.metaplatform.mcp.server.dto.McpServerResponse;
import com.metaplatform.mcp.server.dto.ServerStatusResponse;
import com.metaplatform.mcp.server.service.McpServerService;
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

@WebMvcTest(McpServerController.class)
class McpServerControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private McpServerService mcpServerService;

    private McpServerResponse sampleResponse() {
        return McpServerResponse.builder()
                .id(UUID.randomUUID()).name("srv").code("srv")
                .transportType("HTTP").status("online").config("{}")
                .createdAt(Instant.now()).updatedAt(Instant.now()).build();
    }

    @Test
    void create_server_returns_200() throws Exception {
        when(mcpServerService.create(any())).thenReturn(sampleResponse());

        mockMvc.perform(post("/api/v1/mcp/servers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"srv\",\"code\":\"srv\",\"transportType\":\"HTTP\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.code").value("srv"));
    }

    @Test
    void get_server_by_id() throws Exception {
        UUID id = UUID.randomUUID();
        McpServerResponse response = sampleResponse();
        response.setId(id);
        when(mcpServerService.get(id)).thenReturn(response);

        mockMvc.perform(get("/api/v1/mcp/servers/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(id.toString()));
    }

    @Test
    void list_servers_returns_page() throws Exception {
        McpServerListItem item = McpServerListItem.builder()
                .id(UUID.randomUUID()).name("srv").code("srv")
                .transportType("HTTP").status("online").toolCount(2)
                .build();
        when(mcpServerService.list(any(), any(), any(), any()))
                .thenReturn(PageResponse.<McpServerListItem>builder()
                        .items(List.of(item)).total(1).page(1).size(20).totalPages(1).build());

        mockMvc.perform(get("/api/v1/mcp/servers").param("page", "1").param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].code").value("srv"))
                .andExpect(jsonPath("$.data.items[0].toolCount").value(2));
    }

    @Test
    void start_server_returns_online() throws Exception {
        UUID id = UUID.randomUUID();
        McpServerResponse response = sampleResponse();
        response.setId(id);
        response.setStatus("online");
        when(mcpServerService.start(id)).thenReturn(response);

        mockMvc.perform(post("/api/v1/mcp/servers/{id}/start", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("online"));
    }

    @Test
    void restart_server_returns_online() throws Exception {
        UUID id = UUID.randomUUID();
        McpServerResponse response = sampleResponse();
        response.setId(id);
        response.setStatus("online");
        when(mcpServerService.restart(id)).thenReturn(response);

        mockMvc.perform(post("/api/v1/mcp/servers/{id}/restart", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("online"));
    }

    @Test
    void get_status_returns_connection_status() throws Exception {
        UUID id = UUID.randomUUID();
        when(mcpServerService.status(id))
                .thenReturn(ServerStatusResponse.builder()
                        .status("ACTIVE")
                        .connectionStatus("online")
                        .lastHeartbeatAt(Instant.now())
                        .build());

        mockMvc.perform(get("/api/v1/mcp/servers/{id}/status", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.connectionStatus").value("online"));
    }

    @Test
    void get_capabilities_returns_map() throws Exception {
        UUID id = UUID.randomUUID();
        when(mcpServerService.getCapabilities(id))
                .thenReturn(Map.of("toolCount", 2, "server", Map.of("name", "srv"), "tools", List.of()));

        mockMvc.perform(get("/api/v1/mcp/servers/{id}/capabilities", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.toolCount").value(2));
    }

    @Test
    void delete_server_returns_success() throws Exception {
        UUID id = UUID.randomUUID();
        mockMvc.perform(delete("/api/v1/mcp/servers/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    void start_server_conflict_returns_409() throws Exception {
        UUID id = UUID.randomUUID();
        when(mcpServerService.start(eq(id)))
                .thenThrow(new McpException(ErrorCode.STATE_CONFLICT, "MCP Server 已激活"));

        mockMvc.perform(post("/api/v1/mcp/servers/{id}/start", id))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.STATE_CONFLICT.getCode()));
    }

    @Test
    void generate_ide_config_returns_config() throws Exception {
        UUID id = UUID.randomUUID();
        when(mcpServerService.generateIdeConfig(id, "cursor"))
                .thenReturn(IdeConfigResponse.builder()
                        .ideType("cursor")
                        .fileName("mcp.json")
                        .contentType("application/json")
                        .content("{\"mcpServers\":{}}")
                        .build());

        mockMvc.perform(get("/api/v1/mcp/servers/{id}/ide-config", id).param("ide", "cursor"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ideType").value("cursor"))
                .andExpect(jsonPath("$.data.fileName").value("mcp.json"))
                .andExpect(jsonPath("$.data.content").isString());
    }

    @Test
    void get_connection_status_returns_status() throws Exception {
        UUID id = UUID.randomUUID();
        when(mcpServerService.getConnectionStatus(id))
                .thenReturn(ConnectionStatusResponse.builder()
                        .id(id)
                        .name("srv")
                        .type("server")
                        .connectionStatus("online")
                        .status("ACTIVE")
                        .build());

        mockMvc.perform(get("/api/v1/mcp/servers/{id}/connection-status", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(id.toString()))
                .andExpect(jsonPath("$.data.connectionStatus").value("online"));
    }
}
