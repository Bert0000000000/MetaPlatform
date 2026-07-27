package com.metaplatform.mcp.server.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.server.dto.CreateMcpServerRequest;
import com.metaplatform.mcp.server.dto.McpServerResponse;
import com.metaplatform.mcp.server.dto.ServerStatusResponse;
import com.metaplatform.mcp.server.dto.UpdateMcpServerRequest;
import com.metaplatform.mcp.server.entity.McpServerEntity;
import com.metaplatform.mcp.server.repository.McpServerRepository;
import com.metaplatform.mcp.tool.entity.McpToolEntity;
import com.metaplatform.mcp.tool.repository.McpToolRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class McpServerServiceTest {

    @Mock
    private McpServerRepository mcpServerRepository;
    @Mock
    private McpToolRepository mcpToolRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private McpServerService mcpServerService;

    @BeforeEach
    void setUp() {
        mcpServerService = new McpServerService(mcpServerRepository, mcpToolRepository, objectMapper);
    }

    private McpServerEntity serverEntity(String code, String status) {
        Instant now = Instant.now();
        return McpServerEntity.builder()
                .id(UUID.randomUUID())
                .tenantId("tenant-default")
                .name("server-" + code)
                .code(code)
                .transportType("HTTP")
                .endpointUrl("http://example.com")
                .authType("none")
                .authConfig("{}")
                .status(status)
                .config("{}")
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    @Test
    void create_server_success() {
        CreateMcpServerRequest request = new CreateMcpServerRequest();
        request.setName("My Server");
        request.setCode("my_server");
        request.setTransportType("http");
        request.setHost("0.0.0.0");
        request.setPort(8080);
        request.setAuthType("apikey");
        request.setTimeoutMs(30000);
        request.setMaxConcurrentCalls(100);

        when(mcpServerRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "my_server"))
                .thenReturn(false);
        when(mcpServerRepository.save(any(McpServerEntity.class))).thenAnswer(inv -> {
            McpServerEntity e = inv.getArgument(0);
            e.setId(UUID.randomUUID());
            return e;
        });
        when(mcpToolRepository.findByTenantIdAndServerIdAndDeletedAtIsNull(any(), any()))
                .thenReturn(List.of());

        McpServerResponse response = mcpServerService.create(request);

        assertThat(response.getCode()).isEqualTo("my_server");
        assertThat(response.getTransportType()).isEqualTo("HTTP");
        assertThat(response.getHost()).isEqualTo("0.0.0.0");
        assertThat(response.getPort()).isEqualTo(8080);
        assertThat(response.getAuthType()).isEqualTo("apikey");
        assertThat(response.getStatus()).isEqualTo("offline");
    }

    @Test
    void create_duplicate_code_throws() {
        CreateMcpServerRequest request = new CreateMcpServerRequest();
        request.setName("Server");
        request.setCode("dup");
        request.setTransportType("HTTP");

        when(mcpServerRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "dup"))
                .thenReturn(true);

        assertThatThrownBy(() -> mcpServerService.create(request))
                .isInstanceOf(McpException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.ALREADY_EXISTS);
    }

    @Test
    void start_and_stop_server() {
        UUID id = UUID.randomUUID();
        McpServerEntity inactive = serverEntity("s1", "INACTIVE");
        when(mcpServerRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(inactive));
        when(mcpServerRepository.save(any(McpServerEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(mcpToolRepository.findByTenantIdAndServerIdAndDeletedAtIsNull(any(), any()))
                .thenReturn(List.of());
        McpServerResponse started = mcpServerService.start(id);
        assertThat(started.getStatus()).isEqualTo("online");
        assertThat(started.getLastHeartbeatAt()).isNotNull();

        McpServerEntity active = serverEntity("s1", "ACTIVE");
        when(mcpServerRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(active));
        McpServerResponse stopped = mcpServerService.stop(id);
        assertThat(stopped.getStatus()).isEqualTo("offline");
    }

    @Test
    void restart_server_returns_online() {
        UUID id = UUID.randomUUID();
        McpServerEntity entity = serverEntity("s1", "ACTIVE");
        when(mcpServerRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));
        when(mcpServerRepository.save(any(McpServerEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(mcpToolRepository.findByTenantIdAndServerIdAndDeletedAtIsNull(any(), any()))
                .thenReturn(List.of());

        McpServerResponse response = mcpServerService.restart(id);

        assertThat(response.getStatus()).isEqualTo("online");
        assertThat(response.getLastHeartbeatAt()).isNotNull();
    }

    @Test
    void status_returns_connection_status() {
        UUID id = UUID.randomUUID();
        McpServerEntity entity = serverEntity("s1", "ACTIVE");
        entity.setLastHeartbeatAt(Instant.now());
        when(mcpServerRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));

        ServerStatusResponse status = mcpServerService.status(id);

        assertThat(status.getStatus()).isEqualTo("ACTIVE");
        assertThat(status.getConnectionStatus()).isEqualTo("online");
        assertThat(status.getLastHeartbeatAt()).isNotNull();
    }

    @Test
    void start_already_active_throws_conflict() {
        UUID id = UUID.randomUUID();
        McpServerEntity active = serverEntity("s1", "ACTIVE");
        when(mcpServerRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(active));

        assertThatThrownBy(() -> mcpServerService.start(id))
                .isInstanceOf(McpException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.STATE_CONFLICT);
    }

    @Test
    void update_server_partial() {
        UUID id = UUID.randomUUID();
        McpServerEntity entity = serverEntity("s1", "INACTIVE");
        when(mcpServerRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));
        when(mcpServerRepository.save(any(McpServerEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(mcpToolRepository.findByTenantIdAndServerIdAndDeletedAtIsNull(any(), any()))
                .thenReturn(List.of());

        UpdateMcpServerRequest request = new UpdateMcpServerRequest();
        request.setName("New Name");
        request.setHost("127.0.0.1");
        request.setPort(9090);

        McpServerResponse response = mcpServerService.update(id, request);
        assertThat(response.getName()).isEqualTo("New Name");
        assertThat(response.getHost()).isEqualTo("127.0.0.1");
        assertThat(response.getPort()).isEqualTo(9090);
    }

    @Test
    void get_capabilities_returns_tools() {
        UUID id = UUID.randomUUID();
        McpServerEntity entity = serverEntity("s1", "ACTIVE");
        when(mcpServerRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));

        McpToolEntity tool = McpToolEntity.builder()
                .id(UUID.randomUUID()).name("t").code("t").toolType("HTTP").enabled(true).build();
        when(mcpToolRepository.findByTenantIdAndServerIdAndDeletedAtIsNull("tenant-default", id))
                .thenReturn(List.of(tool));

        Map<String, Object> caps = mcpServerService.getCapabilities(id);

        assertThat(caps.get("toolCount")).isEqualTo(1);
        assertThat(caps).containsKey("server");
        assertThat(caps).containsKey("tools");
    }

    @Test
    void get_not_found_throws() {
        UUID id = UUID.randomUUID();
        when(mcpServerRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> mcpServerService.get(id))
                .isInstanceOf(McpException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.SERVER_NOT_FOUND);
    }
}
