package com.metaplatform.mcp.trust.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.external.entity.ExternalAgentEntity;
import com.metaplatform.mcp.external.repository.ExternalAgentRepository;
import com.metaplatform.mcp.trust.dto.CreateTrustRequest;
import com.metaplatform.mcp.trust.dto.TrustResponse;
import com.metaplatform.mcp.trust.dto.UpdateTrustRequest;
import com.metaplatform.mcp.trust.entity.AgentTrustEntity;
import com.metaplatform.mcp.trust.repository.AgentTrustRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AgentTrustServiceTest {

    @Mock
    private AgentTrustRepository trustRepository;

    @Mock
    private ExternalAgentRepository externalAgentRepository;

    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private AgentTrustService service;

    private ExternalAgentEntity sampleAgent() {
        return ExternalAgentEntity.builder()
                .id(UUID.randomUUID())
                .tenantId("tenant-default")
                .name("agent")
                .endpoint("http://localhost:9001")
                .trustLevel("UNTRUSTED")
                .build();
    }

    @Test
    void create_synchronizes_agent_trust_level() {
        ExternalAgentEntity agent = sampleAgent();
        CreateTrustRequest request = new CreateTrustRequest();
        request.setAgentId(agent.getId());
        request.setTrustLevel("TRUSTED");
        when(externalAgentRepository.findByIdAndTenantIdAndDeletedAtIsNull(any(), any())).thenReturn(Optional.of(agent));
        when(trustRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(externalAgentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        TrustResponse response = service.create(request);

        assertThat(response.getTrustLevel()).isEqualTo("TRUSTED");
        assertThat(agent.getTrustLevel()).isEqualTo("TRUSTED");
    }

    @Test
    void create_with_invalid_agent_throws() {
        CreateTrustRequest request = new CreateTrustRequest();
        request.setAgentId(UUID.randomUUID());
        request.setTrustLevel("TRUSTED");
        when(externalAgentRepository.findByIdAndTenantIdAndDeletedAtIsNull(any(), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(request)).isInstanceOf(McpException.class);
    }

    @Test
    void update_changes_trust_level() {
        AgentTrustEntity entity = AgentTrustEntity.builder()
                .id(UUID.randomUUID())
                .tenantId("tenant-default")
                .agentId(UUID.randomUUID())
                .trustLevel("UNTRUSTED")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        UpdateTrustRequest request = new UpdateTrustRequest();
        request.setTrustLevel("BLOCKED");
        when(trustRepository.findByIdAndTenantId(any(), any())).thenReturn(Optional.of(entity));
        when(trustRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(externalAgentRepository.findByIdAndTenantIdAndDeletedAtIsNull(any(), any()))
                .thenReturn(Optional.of(ExternalAgentEntity.builder().id(entity.getAgentId()).trustLevel("UNTRUSTED").build()));
        when(externalAgentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        TrustResponse response = service.update(entity.getId(), request);

        assertThat(response.getTrustLevel()).isEqualTo("BLOCKED");
    }
}
