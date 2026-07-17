package com.metaplatform.obs.trace.service;

import com.metaplatform.obs.common.ErrorCode;
import com.metaplatform.obs.common.TenantContext;
import com.metaplatform.obs.dto.PageResponse;
import com.metaplatform.obs.exception.ObsException;
import com.metaplatform.obs.topology.dto.ServiceDependenciesResponse;
import com.metaplatform.obs.trace.dto.Span;
import com.metaplatform.obs.trace.dto.TopologyEdge;
import com.metaplatform.obs.trace.dto.TopologyGraph;
import com.metaplatform.obs.trace.dto.TopologyNode;
import com.metaplatform.obs.trace.dto.TraceDetail;
import com.metaplatform.obs.trace.entity.ObsTraceEntity;
import com.metaplatform.obs.trace.entity.ServiceDependencyEntity;
import com.metaplatform.obs.trace.repository.ObsTraceRepository;
import com.metaplatform.obs.trace.repository.ServiceDependencyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class TraceService {

    private final ObsTraceRepository traceRepository;
    private final ServiceDependencyRepository dependencyRepository;

    public PageResponse<Span> searchTraces(String service, String operation,
                                           OffsetDateTime startTime, OffsetDateTime endTime,
                                           Integer page, Integer size) {
        String tenantId = TenantContext.get();
        long startUs = startTime != null ? startTime.toInstant().toEpochMilli() * 1000L : 0L;
        long endUs = endTime != null ? endTime.toInstant().toEpochMilli() * 1000L : 0L;
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 50 : Math.min(size, 500);
        long offset = (long) (p - 1) * s;

        long total = traceRepository.countSearch(tenantId, service, operation, startUs, endUs);
        List<ObsTraceEntity> rows = total == 0
                ? List.of()
                : traceRepository.search(tenantId, service, operation, startUs, endUs, s, (int) offset);
        List<Span> spans = new ArrayList<>(rows.size());
        for (ObsTraceEntity e : rows) {
            spans.add(toSpan(e));
        }
        long totalPages = total == 0 ? 0 : (total + s - 1) / s;
        return PageResponse.<Span>builder()
                .items(spans)
                .total(total)
                .page(p)
                .pageSize(s)
                .totalPages(totalPages)
                .build();
    }

    public TraceDetail getTraceDetail(String traceId) {
        if (traceId == null || traceId.isBlank()) {
            throw new ObsException(ErrorCode.MISSING_REQUIRED_FIELD, "traceId 不能为空");
        }
        List<ObsTraceEntity> rows = traceRepository.findSpansByTraceId(traceId);
        if (rows.isEmpty()) {
            throw new ObsException(ErrorCode.LOG_NOT_FOUND, "Trace 不存在: " + traceId);
        }
        List<Span> spans = new ArrayList<>(rows.size());
        long minStart = Long.MAX_VALUE;
        long maxEnd = 0L;
        String rootService = null;
        int errors = 0;
        for (ObsTraceEntity e : rows) {
            Span span = toSpan(e);
            spans.add(span);
            if (e.getStartTimeUs() < minStart) {
                minStart = e.getStartTimeUs();
                rootService = e.getServiceName();
            }
            long end = e.getStartTimeUs() + e.getDurationUs();
            if (end > maxEnd) {
                maxEnd = end;
            }
            if ("ERROR".equalsIgnoreCase(e.getStatus())) {
                errors++;
            }
        }
        Instant startInstant = Instant.ofEpochMilli(minStart / 1000L);
        return TraceDetail.builder()
                .traceId(traceId)
                .startTime(startInstant)
                .durationUs(maxEnd - minStart)
                .rootService(rootService)
                .spanCount(spans.size())
                .errorCount(errors)
                .spans(spans)
                .build();
    }

    public List<Span> getTraceSpans(String traceId) {
        if (traceId == null || traceId.isBlank()) {
            throw new ObsException(ErrorCode.MISSING_REQUIRED_FIELD, "traceId 不能为空");
        }
        List<ObsTraceEntity> rows = traceRepository.findSpansByTraceId(traceId);
        List<Span> spans = new ArrayList<>(rows.size());
        for (ObsTraceEntity e : rows) {
            spans.add(toSpan(e));
        }
        spans.sort(Comparator.comparingLong(Span::getStartTimeUs));
        return spans;
    }

    public TopologyGraph getTopology() {
        String tenantId = TenantContext.get();
        List<ServiceDependencyEntity> deps = dependencyRepository.findAll(tenantId);
        return buildGraphFromDependencies(deps);
    }

    public ServiceDependenciesResponse getServiceDependencies(String service) {
        if (service == null || service.isBlank()) {
            throw new ObsException(ErrorCode.MISSING_REQUIRED_FIELD, "service 不能为空");
        }
        String tenantId = TenantContext.get();
        List<ServiceDependencyEntity> up = dependencyRepository.findUpstream(tenantId, service);
        List<ServiceDependencyEntity> down = dependencyRepository.findDownstream(tenantId, service);
        List<String> upstream = new ArrayList<>(up.size());
        for (ServiceDependencyEntity dep : up) {
            upstream.add(dep.getSourceService());
        }
        List<String> downstream = new ArrayList<>(down.size());
        for (ServiceDependencyEntity dep : down) {
            downstream.add(dep.getTargetService());
        }
        return ServiceDependenciesResponse.builder()
                .service(service)
                .upstream(upstream)
                .downstream(downstream)
                .build();
    }

    private TopologyGraph buildGraphFromDependencies(List<ServiceDependencyEntity> deps) {
        Map<String, TopologyNode> nodes = new HashMap<>();
        List<TopologyEdge> edges = new ArrayList<>();
        for (ServiceDependencyEntity dep : deps) {
            nodes.computeIfAbsent(dep.getSourceService(), k -> TopologyNode.builder()
                    .service(k).callCount(0L).avgDurationMs(0.0).status("UNKNOWN").build());
            nodes.computeIfAbsent(dep.getTargetService(), k -> TopologyNode.builder()
                    .service(k).callCount(0L).avgDurationMs(0.0).status("UNKNOWN").build());
            edges.add(TopologyEdge.builder()
                    .source(dep.getSourceService())
                    .target(dep.getTargetService())
                    .callCount(dep.getCallCount())
                    .avgDurationMs(dep.getAvgDurationMs())
                    .build());
        }
        return TopologyGraph.builder()
                .nodes(new ArrayList<>(nodes.values()))
                .edges(edges)
                .build();
    }

    private Span toSpan(ObsTraceEntity e) {
        return Span.builder()
                .spanId(e.getSpanId())
                .parentSpanId(e.getParentSpanId())
                .serviceName(e.getServiceName())
                .operationName(e.getOperationName())
                .startTimeUs(e.getStartTimeUs())
                .durationUs(e.getDurationUs())
                .status(e.getStatus())
                .tags(e.getTags())
                .build();
    }
}