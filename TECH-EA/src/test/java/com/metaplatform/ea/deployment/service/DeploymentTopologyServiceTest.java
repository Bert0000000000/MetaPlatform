package com.metaplatform.ea.deployment.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.deployment.dto.CreateDeploymentTopologyRequest;
import com.metaplatform.ea.deployment.dto.DeploymentEdge;
import com.metaplatform.ea.deployment.dto.DeploymentNode;
import com.metaplatform.ea.deployment.dto.DeploymentTopologyResponse;
import com.metaplatform.ea.deployment.dto.UpdateDeploymentTopologyRequest;
import com.metaplatform.ea.deployment.entity.DeploymentTopologyEntity;
import com.metaplatform.ea.deployment.repository.DeploymentTopologyRepository;
import com.metaplatform.ea.exception.EaException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeploymentTopologyServiceTest {

    @Mock
    private DeploymentTopologyRepository repository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private DeploymentTopologyService service;

    private UUID topologyId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        topologyId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldSerializeNodesAndEdges() {
        CreateDeploymentTopologyRequest request = new CreateDeploymentTopologyRequest();
        request.setName("生产环境拓扑");
        request.setEnvironment("prod");
        DeploymentNode node = new DeploymentNode();
        node.setId("n1");
        node.setName("API Gateway");
        node.setType("gateway");
        request.setNodes(List.of(node));
        DeploymentEdge edge = new DeploymentEdge();
        edge.setId("e1");
        edge.setSource("n1");
        edge.setTarget("n2");
        request.setEdges(List.of(edge));

        when(repository.existsByTenantIdAndNameAndDeletedAtIsNull("tenant-default", "生产环境拓扑"))
                .thenReturn(false);
        ArgumentCaptor<DeploymentTopologyEntity> captor = ArgumentCaptor.forClass(DeploymentTopologyEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        DeploymentTopologyResponse response = service.create(request);

        assertThat(captor.getValue().getEnvironment()).isEqualTo("prod");
        assertThat(response.getNodes()).hasSize(1);
        assertThat(response.getEdges()).hasSize(1);
    }

    @Test
    void create_shouldThrow_whenDuplicateName() {
        CreateDeploymentTopologyRequest request = new CreateDeploymentTopologyRequest();
        request.setName("生产环境拓扑");
        request.setEnvironment("prod");

        when(repository.existsByTenantIdAndNameAndDeletedAtIsNull("tenant-default", "生产环境拓扑"))
                .thenReturn(true);

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("已存在同名部署拓扑");
    }

    @Test
    void listByEnvironment_shouldFilter() {
        DeploymentTopologyEntity entity = buildEntity(topologyId, "生产环境拓扑", "prod");
        when(repository.findByTenantIdAndEnvironmentAndDeletedAtIsNull("tenant-default", "prod"))
                .thenReturn(List.of(entity));

        List<DeploymentTopologyResponse> result = service.listByEnvironment("prod");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getEnvironment()).isEqualTo("prod");
    }

    @Test
    void update_shouldReplaceNodes() {
        DeploymentTopologyEntity entity = buildEntity(topologyId, "生产环境拓扑", "prod");
        when(repository.findByIdAndDeletedAtIsNull(topologyId)).thenReturn(Optional.of(entity));
        when(repository.save(any(DeploymentTopologyEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateDeploymentTopologyRequest request = new UpdateDeploymentTopologyRequest();
        DeploymentNode node = new DeploymentNode();
        node.setId("n3");
        node.setName("Cache");
        request.setNodes(List.of(node));

        DeploymentTopologyResponse response = service.update(topologyId, request);

        assertThat(response.getNodes()).hasSize(1);
        assertThat(response.getNodes().get(0).getName()).isEqualTo("Cache");
    }

    @Test
    void delete_shouldSoftDelete() {
        DeploymentTopologyEntity entity = buildEntity(topologyId, "生产环境拓扑", "prod");
        when(repository.findByIdAndDeletedAtIsNull(topologyId)).thenReturn(Optional.of(entity));
        ArgumentCaptor<DeploymentTopologyEntity> captor = ArgumentCaptor.forClass(DeploymentTopologyEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        service.delete(topologyId);

        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    private DeploymentTopologyEntity buildEntity(UUID id, String name, String environment) {
        return DeploymentTopologyEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .name(name)
                .environment(environment)
                .nodes("[]")
                .edges("[]")
                .healthStatus("healthy")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}
