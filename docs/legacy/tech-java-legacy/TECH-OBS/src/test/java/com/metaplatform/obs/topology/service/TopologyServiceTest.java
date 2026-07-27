package com.metaplatform.obs.topology.service;

import com.metaplatform.obs.common.TenantContext;
import com.metaplatform.obs.exception.ObsException;
import com.metaplatform.obs.topology.dto.ServiceDependenciesResponse;
import com.metaplatform.obs.topology.dto.ServiceTopologyResponse;
import com.metaplatform.obs.topology.entity.ServiceHealthEntity;
import com.metaplatform.obs.topology.repository.ServiceHealthRepository;
import com.metaplatform.obs.trace.entity.ServiceDependencyEntity;
import com.metaplatform.obs.trace.repository.ServiceDependencyRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TopologyServiceTest {

    @Mock
    private ServiceDependencyRepository dependencyRepository;

    @Mock
    private ServiceHealthRepository healthRepository;

    private TopologyService service;

    @BeforeEach
    void setUp() {
        service = new TopologyService(dependencyRepository, healthRepository);
        TenantContext.set("tenant-test");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    @DisplayName("getTopology 应合并依赖与已知健康节点")
    void shouldBuildTopology() {
        when(dependencyRepository.findAll("tenant-test")).thenReturn(List.of(
                ServiceDependencyEntity.builder()
                        .sourceService("tech-iam").targetService("tech-rag")
                        .callCount(10).avgDurationMs(50.0).build()));
        when(healthRepository.findByServiceName("tenant-test", "tech-iam")).thenReturn(
                ServiceHealthEntity.builder()
                        .serviceName("tech-iam").status("HEALTHY")
                        .responseTimeMs(45.0).errorRate(0.001).build());
        when(healthRepository.findByServiceName("tenant-test", "tech-rag")).thenReturn(
                ServiceHealthEntity.builder()
                        .serviceName("tech-rag").status("DEGRADED")
                        .responseTimeMs(120.0).errorRate(0.05).build());
        when(healthRepository.findAll("tenant-test")).thenReturn(List.of(
                ServiceHealthEntity.builder()
                        .serviceName("tech-iam").status("HEALTHY")
                        .responseTimeMs(45.0).errorRate(0.001).build(),
                ServiceHealthEntity.builder()
                        .serviceName("tech-rag").status("DEGRADED")
                        .responseTimeMs(120.0).errorRate(0.05).build(),
                ServiceHealthEntity.builder()
                        .serviceName("tech-llm").status("UNKNOWN")
                        .responseTimeMs(0.0).errorRate(0.0).build()));

        ServiceTopologyResponse topology = service.getTopology();

        assertThat(topology.getEdges()).hasSize(1);
        assertThat(topology.getNodes()).hasSize(3);
        assertThat(topology.getNodes())
                .extracting(ServiceTopologyResponse.ServiceNode::getStatus)
                .containsExactlyInAnyOrder("HEALTHY", "DEGRADED", "UNKNOWN");
    }

    @Test
    @DisplayName("getTopology 在没有依赖时仅返回健康节点")
    void shouldReturnOnlyHealthWhenNoDependencies() {
        when(dependencyRepository.findAll("tenant-test")).thenReturn(List.of());
        when(healthRepository.findAll("tenant-test")).thenReturn(List.of(
                ServiceHealthEntity.builder().serviceName("tech-x").status("HEALTHY").build()));

        ServiceTopologyResponse topology = service.getTopology();
        assertThat(topology.getEdges()).isEmpty();
        assertThat(topology.getNodes()).hasSize(1);
        assertThat(topology.getNodes().get(0).getService()).isEqualTo("tech-x");
    }

    @Test
    @DisplayName("getServiceDependencies 应列出上游与下游")
    void shouldReturnServiceDependencies() {
        when(dependencyRepository.findUpstream("tenant-test", "tech-rag")).thenReturn(List.of(
                ServiceDependencyEntity.builder().sourceService("tech-iam").targetService("tech-rag").build(),
                ServiceDependencyEntity.builder().sourceService("tech-portal").targetService("tech-rag").build()));
        when(dependencyRepository.findDownstream("tenant-test", "tech-rag")).thenReturn(List.of(
                ServiceDependencyEntity.builder().sourceService("tech-rag").targetService("tech-llm").build()));

        ServiceDependenciesResponse resp = service.getServiceDependencies("tech-rag");
        assertThat(resp.getUpstream()).containsExactlyInAnyOrder("tech-iam", "tech-portal");
        assertThat(resp.getDownstream()).containsExactly("tech-llm");
    }

    @Test
    @DisplayName("getServiceDependencies 空 service 应抛错")
    void shouldRejectBlankService() {
        assertThatThrownBy(() -> service.getServiceDependencies(" "))
                .isInstanceOf(ObsException.class);
    }

    @Test
    @DisplayName("refreshHealth 应遍历所有依赖中的服务并 upsert")
    void shouldRefreshHealth() {
        when(dependencyRepository.findAll("tenant-test")).thenReturn(List.of(
                ServiceDependencyEntity.builder().sourceService("tech-iam").targetService("tech-rag").build(),
                ServiceDependencyEntity.builder().sourceService("tech-rag").targetService("tech-llm").build()));
        when(healthRepository.findByServiceName(eq("tenant-test"), any())).thenReturn(null);

        int updated = service.refreshHealth();
        assertThat(updated).isEqualTo(3); // 3 unique services
    }

    @Test
    @DisplayName("reportHealth 应写入最新状态")
    void shouldReportHealth() {
        when(healthRepository.upsert(any(ServiceHealthEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        ServiceHealthEntity result = service.reportHealth("tech-iam", "DEGRADED", 120.0, 0.05);
        assertThat(result.getStatus()).isEqualTo("DEGRADED");
        assertThat(result.getResponseTimeMs()).isEqualTo(120.0);
        assertThat(result.getErrorRate()).isEqualTo(0.05);
    }

    @Test
    @DisplayName("getServiceHealth 缺失应抛 LOG_NOT_FOUND")
    void shouldRejectMissingHealthRecord() {
        when(healthRepository.findByServiceName("tenant-test", "tech-x")).thenReturn(null);
        assertThatThrownBy(() -> service.getServiceHealth("tech-x"))
                .isInstanceOf(ObsException.class);
    }

    @Test
    @DisplayName("getServiceHealth 存在应返回记录")
    void shouldReturnServiceHealth() {
        when(healthRepository.findByServiceName("tenant-test", "tech-iam"))
                .thenReturn(ServiceHealthEntity.builder()
                        .serviceName("tech-iam").status("HEALTHY")
                        .lastCheckAt(Instant.now()).build());

        ServiceHealthEntity result = service.getServiceHealth("tech-iam");
        assertThat(result.getStatus()).isEqualTo("HEALTHY");
    }
}