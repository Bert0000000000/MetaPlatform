package com.metaplatform.mcp.client.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.client.dto.CreateMcpClientRequest;
import com.metaplatform.mcp.client.dto.McpClientResponse;
import com.metaplatform.mcp.client.dto.UpdateMcpClientRequest;
import com.metaplatform.mcp.client.entity.McpClientConnectionEntity;
import com.metaplatform.mcp.client.repository.McpClientConnectionRepository;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.tool.dto.McpToolListItem;
import com.metaplatform.mcp.tool.entity.McpToolEntity;
import com.metaplatform.mcp.tool.repository.McpToolRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class McpClientServiceTest {

    @Mock
    private McpClientConnectionRepository clientRepository;
    @Mock
    private McpToolRepository mcpToolRepository;
    @Mock
    private WebClient.Builder webClientBuilder;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private McpClientService mcpClientService;

    @BeforeEach
    void setUp() {
        mcpClientService = new McpClientService(clientRepository, mcpToolRepository, objectMapper, webClientBuilder);
    }

    private McpClientConnectionEntity clientEntity(UUID id, String serverUrl, String status) {
        Instant now = Instant.now();
        return McpClientConnectionEntity.builder()
                .id(id).tenantId("tenant-default").name("client")
                .serverUrl(serverUrl).transportType("HTTP").status(status)
                .config("{}").createdAt(now).updatedAt(now).build();
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private void stubWebClient(String responseBody) {
        WebClient client = mock(WebClient.class);
        WebClient.RequestBodyUriSpec postSpec = mock(WebClient.RequestBodyUriSpec.class);
        WebClient.RequestHeadersSpec headersSpec = mock(WebClient.RequestHeadersSpec.class);
        WebClient.ResponseSpec responseSpec = mock(WebClient.ResponseSpec.class);
        when(webClientBuilder.build()).thenReturn(client);
        when(client.post()).thenReturn(postSpec);
        when(postSpec.uri(anyString())).thenReturn(postSpec);
        when(postSpec.contentType(any())).thenReturn(postSpec);
        when(postSpec.accept(any(MediaType[].class))).thenReturn(postSpec);
        when(postSpec.bodyValue(any())).thenReturn(headersSpec);
        when(headersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(String.class)).thenReturn(Mono.just(responseBody));
    }

    @Test
    void create_client_success() {
        CreateMcpClientRequest request = new CreateMcpClientRequest();
        request.setName("my-client");
        request.setServerUrl("http://remote:8080/jsonrpc");

        when(clientRepository.existsByTenantIdAndNameAndDeletedAtIsNull("tenant-default", "my-client"))
                .thenReturn(false);
        when(clientRepository.save(any(McpClientConnectionEntity.class))).thenAnswer(inv -> {
            McpClientConnectionEntity e = inv.getArgument(0);
            e.setId(UUID.randomUUID());
            return e;
        });

        McpClientResponse response = mcpClientService.create(request);

        assertThat(response.getName()).isEqualTo("my-client");
        assertThat(response.getStatus()).isEqualTo("DISCONNECTED");
        assertThat(response.getTransportType()).isEqualTo("HTTP");
    }

    @Test
    void get_client_not_found_throws() {
        UUID id = UUID.randomUUID();
        when(clientRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> mcpClientService.get(id))
                .isInstanceOf(McpException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.CLIENT_NOT_FOUND);
    }

    @Test
    void update_client_partial() {
        UUID id = UUID.randomUUID();
        McpClientConnectionEntity entity = clientEntity(id, "http://x", "DISCONNECTED");
        when(clientRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));
        when(clientRepository.save(any(McpClientConnectionEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateMcpClientRequest request = new UpdateMcpClientRequest();
        request.setName("new-name");

        McpClientResponse response = mcpClientService.update(id, request);
        assertThat(response.getName()).isEqualTo("new-name");
    }

    @Test
    void list_clients_returns_page() {
        McpClientConnectionEntity entity = clientEntity(UUID.randomUUID(), "http://x", "CONNECTED");
        when(clientRepository.search(anyString(), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(entity), PageRequest.of(0, 20), 1));

        PageResponse<McpClientResponse> page = mcpClientService.list(null, null, 1, 20);

        assertThat(page.getItems()).hasSize(1);
        assertThat(page.getTotal()).isEqualTo(1);
    }

    @Test
    void test_connection_success_marks_connected() {
        UUID id = UUID.randomUUID();
        McpClientConnectionEntity entity = clientEntity(id, "http://remote:8080/jsonrpc", "DISCONNECTED");
        when(clientRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));
        stubWebClient("{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{}}}");
        when(clientRepository.save(any(McpClientConnectionEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        McpClientResponse response = mcpClientService.testConnection(id);

        assertThat(response.getStatus()).isEqualTo("CONNECTED");
        assertThat(response.getLastConnectedAt()).isNotNull();
    }

    @Test
    void test_connection_failure_marks_disconnected() {
        UUID id = UUID.randomUUID();
        McpClientConnectionEntity entity = clientEntity(id, "http://remote:8080/jsonrpc", "CONNECTED");
        when(clientRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));
        when(clientRepository.save(any(McpClientConnectionEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        McpClientResponse response = mcpClientService.testConnection(id);

        assertThat(response.getStatus()).isEqualTo("DISCONNECTED");
    }

    @Test
    void discover_tools_success_syncs_tools() {
        UUID id = UUID.randomUUID();
        McpClientConnectionEntity entity = clientEntity(id, "http://remote:8080/jsonrpc", "DISCONNECTED");
        when(clientRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));
        stubWebClient("{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"tools\":[{\"name\":\"remote_tool\",\"description\":\"a tool\",\"inputSchema\":{\"type\":\"object\"}}]}}");
        when(mcpToolRepository.findByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "remote_tool"))
                .thenReturn(Optional.empty());
        when(mcpToolRepository.save(any(McpToolEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(clientRepository.save(any(McpClientConnectionEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        McpToolEntity synced = McpToolEntity.builder()
                .id(UUID.randomUUID()).tenantId("tenant-default").serverId(id)
                .name("remote_tool").code("remote_tool").toolType("MCP").enabled(true)
                .createdAt(Instant.now()).updatedAt(Instant.now()).build();
        when(mcpToolRepository.findByTenantIdAndServerIdAndDeletedAtIsNull("tenant-default", id))
                .thenReturn(List.of(synced));

        List<McpToolListItem> discovered = mcpClientService.discoverTools(id);

        assertThat(discovered).hasSize(1);
        assertThat(discovered.get(0).getCode()).isEqualTo("remote_tool");
        assertThat(discovered.get(0).getToolType()).isEqualTo("MCP");
        verify(mcpToolRepository).save(any(McpToolEntity.class));
    }

    @Test
    void discover_tools_failure_throws_discovery_error() {
        UUID id = UUID.randomUUID();
        McpClientConnectionEntity entity = clientEntity(id, "http://remote:8080/jsonrpc", "DISCONNECTED");
        when(clientRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> mcpClientService.discoverTools(id))
                .isInstanceOf(McpException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.DISCOVERY_ERROR);
    }
}
