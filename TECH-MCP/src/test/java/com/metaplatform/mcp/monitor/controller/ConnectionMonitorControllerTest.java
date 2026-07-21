package com.metaplatform.mcp.monitor.controller;

import com.metaplatform.mcp.monitor.dto.ConnectionMonitorResponse;
import com.metaplatform.mcp.monitor.service.ConnectionMonitorService;
import com.metaplatform.mcp.server.dto.ConnectionStatusResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ConnectionMonitorController.class)
class ConnectionMonitorControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ConnectionMonitorService connectionMonitorService;

    @Test
    void get_connection_monitor_returns_summary() throws Exception {
        UUID serverId = UUID.randomUUID();
        UUID clientId = UUID.randomUUID();
        when(connectionMonitorService.getMonitor()).thenReturn(ConnectionMonitorResponse.builder()
                .summary(ConnectionMonitorResponse.Summary.builder()
                        .totalServers(1)
                        .onlineServers(1)
                        .offlineServers(0)
                        .errorServers(0)
                        .totalClients(1)
                        .connectedClients(0)
                        .disconnectedClients(1)
                        .errorClients(0)
                        .build())
                .servers(List.of(ConnectionStatusResponse.builder()
                        .id(serverId)
                        .name("srv")
                        .type("server")
                        .connectionStatus("online")
                        .status("ACTIVE")
                        .build()))
                .clients(List.of(ConnectionStatusResponse.builder()
                        .id(clientId)
                        .name("cli")
                        .type("client")
                        .connectionStatus("offline")
                        .status("DISCONNECTED")
                        .build()))
                .build());

        mockMvc.perform(get("/api/v1/mcp/connection-monitor").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.summary.totalServers").value(1))
                .andExpect(jsonPath("$.data.summary.onlineServers").value(1))
                .andExpect(jsonPath("$.data.summary.totalClients").value(1))
                .andExpect(jsonPath("$.data.servers[0].connectionStatus").value("online"))
                .andExpect(jsonPath("$.data.clients[0].connectionStatus").value("offline"));
    }
}
