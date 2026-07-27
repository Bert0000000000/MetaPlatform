package com.metaplatform.mcp.monitor.service;

import com.metaplatform.mcp.client.entity.McpClientConnectionEntity;
import com.metaplatform.mcp.client.repository.McpClientConnectionRepository;
import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.monitor.dto.ConnectionMonitorResponse;
import com.metaplatform.mcp.server.dto.ConnectionStatusResponse;
import com.metaplatform.mcp.server.entity.McpServerEntity;
import com.metaplatform.mcp.server.repository.McpServerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ConnectionMonitorService {

    private static final String SERVER_ACTIVE = "ACTIVE";
    private static final String SERVER_ERROR = "ERROR";
    private static final String CLIENT_CONNECTED = "CONNECTED";
    private static final String CLIENT_ERROR = "ERROR";

    private final McpServerRepository serverRepository;
    private final McpClientConnectionRepository clientRepository;

    @Transactional(readOnly = true)
    public ConnectionMonitorResponse getMonitor() {
        String tenantId = TenantContext.getOrDefault();
        List<McpServerEntity> servers = serverRepository.findByTenantIdAndDeletedAtIsNull(
                tenantId, Sort.by(Sort.Direction.DESC, "updatedAt"));
        List<McpClientConnectionEntity> clients = clientRepository.findByTenantIdAndDeletedAtIsNull(
                tenantId, Sort.by(Sort.Direction.DESC, "updatedAt"));

        List<ConnectionStatusResponse> serverStatusList = servers.stream().map(this::toServerStatus).toList();
        List<ConnectionStatusResponse> clientStatusList = clients.stream().map(this::toClientStatus).toList();

        return ConnectionMonitorResponse.builder()
                .summary(buildSummary(serverStatusList, clientStatusList))
                .servers(serverStatusList)
                .clients(clientStatusList)
                .build();
    }

    private ConnectionStatusResponse toServerStatus(McpServerEntity entity) {
        return ConnectionStatusResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .type("server")
                .transportType(entity.getTransportType())
                .status(entity.getStatus())
                .connectionStatus(toServerConnectionStatus(entity.getStatus()))
                .lastHeartbeatAt(entity.getLastHeartbeatAt())
                .lastErrorMessage(entity.getLastErrorMessage())
                .errorRate(0.0)
                .latencyMs(entity.getTimeoutMs() != null ? entity.getTimeoutMs().longValue() : null)
                .endpoint(entity.getEndpointUrl())
                .build();
    }

    private ConnectionStatusResponse toClientStatus(McpClientConnectionEntity entity) {
        return ConnectionStatusResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .type("client")
                .transportType(entity.getTransportType())
                .status(entity.getStatus())
                .connectionStatus(toClientConnectionStatus(entity.getStatus()))
                .lastHeartbeatAt(entity.getLastConnectedAt())
                .lastErrorMessage(null)
                .errorRate(0.0)
                .latencyMs(entity.getTimeoutMs() != null ? entity.getTimeoutMs().longValue() : null)
                .endpoint(entity.getBaseUrl() != null ? entity.getBaseUrl() : entity.getServerUrl())
                .build();
    }

    private String toServerConnectionStatus(String status) {
        if (SERVER_ACTIVE.equals(status)) {
            return "online";
        }
        if (SERVER_ERROR.equals(status)) {
            return "error";
        }
        return "offline";
    }

    private String toClientConnectionStatus(String status) {
        if (CLIENT_CONNECTED.equals(status)) {
            return "online";
        }
        if (CLIENT_ERROR.equals(status)) {
            return "error";
        }
        return "offline";
    }

    private ConnectionMonitorResponse.Summary buildSummary(
            List<ConnectionStatusResponse> servers,
            List<ConnectionStatusResponse> clients) {
        long onlineServers = servers.stream().filter(s -> "online".equals(s.getConnectionStatus())).count();
        long offlineServers = servers.stream().filter(s -> "offline".equals(s.getConnectionStatus())).count();
        long errorServers = servers.stream().filter(s -> "error".equals(s.getConnectionStatus())).count();
        long connectedClients = clients.stream().filter(c -> "online".equals(c.getConnectionStatus())).count();
        long disconnectedClients = clients.stream().filter(c -> "offline".equals(c.getConnectionStatus())).count();
        long errorClients = clients.stream().filter(c -> "error".equals(c.getConnectionStatus())).count();

        return ConnectionMonitorResponse.Summary.builder()
                .totalServers(servers.size())
                .onlineServers((int) onlineServers)
                .offlineServers((int) offlineServers)
                .errorServers((int) errorServers)
                .totalClients(clients.size())
                .connectedClients((int) connectedClients)
                .disconnectedClients((int) disconnectedClients)
                .errorClients((int) errorClients)
                .build();
    }
}
