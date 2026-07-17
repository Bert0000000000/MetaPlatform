package com.metaplatform.obs.trace.controller;

import com.metaplatform.obs.common.TraceFilter;
import com.metaplatform.obs.dto.PageResponse;
import com.metaplatform.obs.exception.GlobalExceptionHandler;
import com.metaplatform.obs.trace.dto.Span;
import com.metaplatform.obs.trace.dto.TopologyEdge;
import com.metaplatform.obs.trace.dto.TopologyGraph;
import com.metaplatform.obs.trace.dto.TopologyNode;
import com.metaplatform.obs.trace.dto.TraceDetail;
import com.metaplatform.obs.trace.service.TraceService;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = TraceController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
                classes = TraceFilter.class))
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class TraceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TraceService traceService;

    @Test
    void searchTraces_shouldReturnSuccess() throws Exception {
        PageResponse<Span> page = PageResponse.<Span>builder()
                .total(1).page(1).pageSize(50).totalPages(1)
                .items(List.of(Span.builder()
                        .spanId("span-1").serviceName("tech-iam").operationName("GET /api/users")
                        .startTimeUs(1_000_000L).durationUs(500_000L).status("OK").build()))
                .build();
        when(traceService.searchTraces(any(), any(), any(), any(), any(), any())).thenReturn(page);

        mockMvc.perform(get("/api/v1/obs/traces?service=tech-iam&page=1&size=50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].serviceName").value("tech-iam"))
                .andExpect(jsonPath("$.data.items[0].status").value("OK"));
    }

    @Test
    void getTraceDetail_shouldReturnSuccess() throws Exception {
        TraceDetail detail = TraceDetail.builder()
                .traceId("trace-1")
                .startTime(Instant.parse("2026-07-16T00:00:00Z"))
                .durationUs(120_000L)
                .rootService("tech-iam")
                .spanCount(3)
                .errorCount(1)
                .spans(List.of(Span.builder().spanId("s1").serviceName("tech-iam").build()))
                .build();
        when(traceService.getTraceDetail(eq("trace-1"))).thenReturn(detail);

        mockMvc.perform(get("/api/v1/obs/traces/trace-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.traceId").value("trace-1"))
                .andExpect(jsonPath("$.data.spanCount").value(3))
                .andExpect(jsonPath("$.data.errorCount").value(1));
    }

    @Test
    void getTraceSpans_shouldReturnFlatSpanList() throws Exception {
        when(traceService.getTraceSpans(eq("trace-1"))).thenReturn(List.of(
                Span.builder().spanId("s1").serviceName("tech-iam").build(),
                Span.builder().spanId("s2").serviceName("tech-rag").build()));

        mockMvc.perform(get("/api/v1/obs/traces/trace-1/spans"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[1].serviceName").value("tech-rag"));
    }

    @Test
    void getTopology_shouldReturnGraph() throws Exception {
        TopologyGraph graph = TopologyGraph.builder()
                .nodes(List.of(TopologyNode.builder().service("tech-iam").status("HEALTHY").build()))
                .edges(List.of(TopologyEdge.builder().source("tech-iam").target("tech-rag").build()))
                .build();
        when(traceService.getTopology()).thenReturn(graph);

        mockMvc.perform(get("/api/v1/obs/topology"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.nodes[0].service").value("tech-iam"))
                .andExpect(jsonPath("$.data.edges[0].target").value("tech-rag"));
    }
}