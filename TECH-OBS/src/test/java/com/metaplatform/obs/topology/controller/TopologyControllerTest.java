package com.metaplatform.obs.topology.controller;

import com.metaplatform.obs.common.TraceFilter;
import com.metaplatform.obs.exception.GlobalExceptionHandler;
import com.metaplatform.obs.topology.dto.ServiceDependenciesResponse;
import com.metaplatform.obs.topology.dto.ServiceTopologyResponse;
import com.metaplatform.obs.topology.entity.ServiceHealthEntity;
import com.metaplatform.obs.topology.service.TopologyService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = TopologyController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
                classes = TraceFilter.class))
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class TopologyControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TopologyService topologyService;

    @Test
    void getTopology_shouldReturnGraph() throws Exception {
        ServiceTopologyResponse topology = ServiceTopologyResponse.builder()
                .nodes(List.of(ServiceTopologyResponse.ServiceNode.builder()
                        .service("tech-iam").status("HEALTHY").build()))
                .edges(List.of(ServiceTopologyResponse.ServiceEdge.builder()
                        .source("tech-iam").target("tech-rag").build()))
                .build();
        when(topologyService.getTopology()).thenReturn(topology);

        mockMvc.perform(get("/api/v1/obs/service-topology"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.nodes[0].service").value("tech-iam"))
                .andExpect(jsonPath("$.data.edges[0].target").value("tech-rag"));
    }

    @Test
    void getServiceDependencies_shouldReturnUpstreamDownstream() throws Exception {
        ServiceDependenciesResponse resp = ServiceDependenciesResponse.builder()
                .service("tech-rag")
                .upstream(List.of("tech-iam"))
                .downstream(List.of("tech-llm"))
                .build();
        when(topologyService.getServiceDependencies(eq("tech-rag"))).thenReturn(resp);

        mockMvc.perform(get("/api/v1/obs/service-topology/tech-rag/dependencies"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.upstream[0]").value("tech-iam"))
                .andExpect(jsonPath("$.data.downstream[0]").value("tech-llm"));
    }

    @Test
    void refreshHealth_shouldReturnCount() throws Exception {
        when(topologyService.refreshHealth()).thenReturn(5);

        mockMvc.perform(post("/api/v1/obs/service-topology/refresh"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(5));
    }

    @Test
    void getAllHealth_shouldReturnHealthList() throws Exception {
        when(topologyService.getHealth()).thenReturn(List.of(
                ServiceHealthEntity.builder().serviceName("tech-iam").status("HEALTHY")
                        .lastCheckAt(Instant.now()).build()));
        mockMvc.perform(get("/api/v1/obs/service-topology/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].status").value("HEALTHY"));
    }

    @Test
    void reportHealth_shouldReturnRecord() throws Exception {
        ServiceHealthEntity entity = ServiceHealthEntity.builder()
                .serviceName("tech-iam").status("DEGRADED")
                .responseTimeMs(120.0).errorRate(0.05).build();
        when(topologyService.reportHealth(eq("tech-iam"), eq("DEGRADED"), anyDouble(), anyDouble()))
                .thenReturn(entity);

        mockMvc.perform(post("/api/v1/obs/service-topology/health/report")
                        .param("service", "tech-iam")
                        .param("status", "DEGRADED")
                        .param("responseTimeMs", "120.0")
                        .param("errorRate", "0.05"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DEGRADED"));
    }

    @Test
    void getServiceHealth_shouldReturnRecord() throws Exception {
        ServiceHealthEntity entity = ServiceHealthEntity.builder()
                .serviceName("tech-iam").status("HEALTHY")
                .lastCheckAt(Instant.now()).build();
        when(topologyService.getServiceHealth(eq("tech-iam"))).thenReturn(entity);

        mockMvc.perform(get("/api/v1/obs/service-topology/health/tech-iam"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.service").value("tech-iam"));
    }
}