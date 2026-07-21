package com.metaplatform.mcp.external.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.external.dto.CreateExternalAgentRequest;
import com.metaplatform.mcp.external.dto.ExternalAgentResponse;
import com.metaplatform.mcp.external.dto.ExternalAgentTestResult;
import com.metaplatform.mcp.external.dto.UpdateExternalAgentRequest;
import com.metaplatform.mcp.external.entity.ExternalAgentEntity;
import com.metaplatform.mcp.external.repository.ExternalAgentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExternalAgentServiceTest {

    @Mock
    private ExternalAgentRepository repository;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private WebClient.Builder webClientBuilder;

    @InjectMocks
    private ExternalAgentService service;

    private ExternalAgentEntity sampleEntity() {
        return ExternalAgentEntity.builder()
                .id(UUID.randomUUID())
                .tenantId("tenant-default")
                .name("agent")
                .endpoint("http://localhost:9001")
                .protocolType("MCP")
                .status("INACTIVE")
                .trustLevel("UNTRUSTED")
                .authType("none")
                .authConfig("{}")
                .capabilities("[]")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    @Test
    void create_saves_entity() {
        CreateExternalAgentRequest request = new CreateExternalAgentRequest();
        request.setName("agent");
        request.setEndpoint("http://localhost:9001");
        request.setProtocolType("MCP");
        when(repository.existsByTenantIdAndNameAndDeletedAtIsNull(any(), any())).thenReturn(false);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ExternalAgentResponse response = service.create(request);

        assertThat(response.getName()).isEqualTo("agent");
        assertThat(response.getTrustLevel()).isEqualTo("UNTRUSTED");
        verify(repository).save(any(ExternalAgentEntity.class));
    }

    @Test
    void create_duplicate_name_throws() {
        CreateExternalAgentRequest request = new CreateExternalAgentRequest();
        request.setName("agent");
        request.setEndpoint("http://localhost:9001");
        when(repository.existsByTenantIdAndNameAndDeletedAtIsNull(any(), any())).thenReturn(true);

        assertThatThrownBy(() -> service.create(request)).isInstanceOf(McpException.class);
    }

    @Test
    void update_changes_trust_level() {
        ExternalAgentEntity entity = sampleEntity();
        UpdateExternalAgentRequest request = new UpdateExternalAgentRequest();
        request.setTrustLevel("TRUSTED");
        when(repository.findByIdAndTenantIdAndDeletedAtIsNull(any(), any())).thenReturn(Optional.of(entity));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ExternalAgentResponse response = service.update(entity.getId(), request);

        assertThat(response.getTrustLevel()).isEqualTo("TRUSTED");
    }

    @Test
    void delete_sets_deleted_at() {
        ExternalAgentEntity entity = sampleEntity();
        when(repository.findByIdAndTenantIdAndDeletedAtIsNull(any(), any())).thenReturn(Optional.of(entity));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.delete(entity.getId());

        assertThat(entity.getDeletedAt()).isNotNull();
    }

    @Test
    void test_connection_returns_result() {
        ExternalAgentEntity entity = sampleEntity();
        when(repository.findByIdAndTenantIdAndDeletedAtIsNull(any(), any())).thenReturn(Optional.of(entity));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        WebClient webClient = mock(WebClient.class);
        WebClient.RequestHeadersUriSpec getSpec = mock(WebClient.RequestHeadersUriSpec.class);
        WebClient.ResponseSpec responseSpec = mock(WebClient.ResponseSpec.class);
        when(webClientBuilder.build()).thenReturn(webClient);
        when(webClient.get()).thenReturn(getSpec);
        when(getSpec.uri(anyString())).thenReturn(getSpec);
        when(getSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(String.class)).thenReturn(reactor.core.publisher.Mono.just("pong"));

        ExternalAgentTestResult result = service.testConnection(entity.getId());

        assertThat(result.isSuccess()).isTrue();
        assertThat(entity.getStatus()).isEqualTo("ACTIVE");
    }
}
