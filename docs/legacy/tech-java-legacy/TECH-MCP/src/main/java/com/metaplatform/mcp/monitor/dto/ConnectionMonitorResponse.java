package com.metaplatform.mcp.monitor.dto;

import com.metaplatform.mcp.server.dto.ConnectionStatusResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConnectionMonitorResponse {

    private Summary summary;
    private List<ConnectionStatusResponse> servers;
    private List<ConnectionStatusResponse> clients;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Summary {
        private int totalServers;
        private int onlineServers;
        private int offlineServers;
        private int errorServers;
        private int totalClients;
        private int connectedClients;
        private int disconnectedClients;
        private int errorClients;
    }
}
