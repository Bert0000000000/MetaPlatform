package com.metaplatform.obs.trace.service;

import com.metaplatform.obs.common.TenantContext;
import com.metaplatform.obs.dto.PageResponse;
import com.metaplatform.obs.exception.ObsException;
import com.metaplatform.obs.trace.dto.Span;
import com.metaplatform.obs.trace.dto.TopologyGraph;
import com.metaplatform.obs.trace.dto.TraceDetail;
import com.metaplatform.obs.trace.entity.ObsTraceEntity;
import com.metaplatform.obs.trace.entity.ServiceDependencyEntity;
import com.metaplatform.obs.trace.repository.ObsTraceRepository;
import com.metaplatform.obs.trace.repository.ServiceDependencyRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TraceServiceTest {

    @Mock
    private ObsTraceRepository traceRepository;

    @Mock
    private ServiceDependencyRepository dependencyRepository;

    @InjectMocks
    private TraceService traceService;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-test");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    @DisplayName("searchTraces 应返回分页 Span 列表")
    void shouldSearchTraces() {
        when(traceRepository.countSearch(eq("tenant-test"), any(), any(), anyLong(), anyLong()))
                .thenReturn(2L);
        List<ObsTraceEntity> rows = List.of(
                buildSpanEntity("span-1", "tech-iam", 1_000_000L, 500_000L),
                buildSpanEntity("span-2", "tech-iam", 2_000_000L, 800_000L));
        when(traceRepository.search(eq("tenant-test"), any(), any(), anyLong(), anyLong(), anyInt(), anyInt()))
                .thenReturn(rows);

        OffsetDateTime start = OffsetDateTime.of(2026, 7, 16, 0, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime end = OffsetDateTime.of(2026, 7, 16, 23, 59, 59, 0, ZoneOffset.UTC);
        PageResponse<Span> page = traceService.searchTraces("tech-iam", null, start, end, 1, 50);

        assertThat(page.getTotal()).isEqualTo(2L);
        assertThat(page.getItems()).hasSize(2);
        assertThat(page.getItems().get(0).getSpanId()).isEqualTo("span-1");
        assertThat(page.getItems().get(0).getServiceName()).isEqualTo("tech-iam");
    }

    @Test
    @DisplayName("getTraceDetail 不存在时应抛 LOG_NOT_FOUND")
    void shouldThrowWhenTraceNotFound() {
        when(traceRepository.findSpansByTraceId("missing")).thenReturn(List.of());
        assertThatThrownBy(() -> traceService.getTraceDetail("missing"))
                .isInstanceOf(ObsException.class)
                .hasMessageContaining("Trace 不存在");
    }

    @Test
    @DisplayName("getTraceDetail 应按起始时间排序并汇总错误数")
    void shouldBuildTraceDetail() {
        List<ObsTraceEntity> rows = List.of(
                buildSpanEntity("span-1", "tech-iam", 100_000L, 50_000L),
                buildSpanEntity("span-2", "tech-iam", 110_000L, 60_000L),
                buildSpanEntity("span-3", "tech-iam", 120_000L, 70_000L));
        when(traceRepository.findSpansByTraceId("trace-1")).thenReturn(rows);

        TraceDetail detail = traceService.getTraceDetail("trace-1");

        assertThat(detail.getTraceId()).isEqualTo("trace-1");
        assertThat(detail.getSpanCount()).isEqualTo(3);
        assertThat(detail.getRootService()).isEqualTo("tech-iam");
        assertThat(detail.getDurationUs()).isEqualTo(90_000L);
        assertThat(detail.getErrorCount()).isZero();
    }

    @Test
    @DisplayName("getTraceDetail 应正确统计 ERROR span")
    void shouldCountErrorsInTrace() {
        ObsTraceEntity ok = buildSpanEntity("span-1", "tech-iam", 100_000L, 50_000L);
        ObsTraceEntity err = buildSpanEntity("span-2", "tech-iam", 200_000L, 50_000L);
        err.setStatus("ERROR");
        when(traceRepository.findSpansByTraceId("trace-1")).thenReturn(List.of(ok, err));

        TraceDetail detail = traceService.getTraceDetail("trace-1");
        assertThat(detail.getErrorCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("getTopology 应基于依赖表生成节点 + 边")
    void shouldBuildTopology() {
        ServiceDependencyEntity d1 = ServiceDependencyEntity.builder()
                .sourceService("tech-iam").targetService("tech-rag")
                .callCount(10).avgDurationMs(50.0).build();
        ServiceDependencyEntity d2 = ServiceDependencyEntity.builder()
                .sourceService("tech-rag").targetService("tech-llm")
                .callCount(8).avgDurationMs(120.0).build();
        when(dependencyRepository.findAll("tenant-test")).thenReturn(List.of(d1, d2));

        TopologyGraph graph = traceService.getTopology();

        assertThat(graph.getNodes()).hasSize(3);
        assertThat(graph.getEdges()).hasSize(2);
        assertThat(graph.getEdges().get(0).getSource()).isEqualTo("tech-iam");
        assertThat(graph.getEdges().get(1).getTarget()).isEqualTo("tech-llm");
    }

    @Test
    @DisplayName("getServiceDependencies 应分别返回上游和下游服务")
    void shouldReturnServiceDependencies() {
        when(dependencyRepository.findUpstream("tenant-test", "tech-rag"))
                .thenReturn(List.of(ServiceDependencyEntity.builder()
                        .sourceService("tech-iam").targetService("tech-rag").build()));
        when(dependencyRepository.findDownstream("tenant-test", "tech-rag"))
                .thenReturn(List.of(ServiceDependencyEntity.builder()
                        .sourceService("tech-rag").targetService("tech-llm").build()));

        var deps = traceService.getServiceDependencies("tech-rag");
        assertThat(deps.getService()).isEqualTo("tech-rag");
        assertThat(deps.getUpstream()).containsExactly("tech-iam");
        assertThat(deps.getDownstream()).containsExactly("tech-llm");
    }

    @Test
    @DisplayName("getServiceDependencies service 为空时抛错")
    void shouldRejectBlankService() {
        assertThatThrownBy(() -> traceService.getServiceDependencies(""))
                .isInstanceOf(ObsException.class);
    }

    private ObsTraceEntity buildSpanEntity(String spanId, String service, long startUs, long durationUs) {
        return ObsTraceEntity.builder()
                .id(UUID.randomUUID())
                .tenantId("tenant-test")
                .traceId("trace-1")
                .spanId(spanId)
                .parentSpanId(null)
                .serviceName(service)
                .operationName("op-" + spanId)
                .startTimeUs(startUs)
                .durationUs(durationUs)
                .status("OK")
                .createdAt(Instant.now())
                .build();
    }
}