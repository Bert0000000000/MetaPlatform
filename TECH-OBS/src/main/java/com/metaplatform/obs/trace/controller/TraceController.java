package com.metaplatform.obs.trace.controller;

import com.metaplatform.obs.common.ApiResponse;
import com.metaplatform.obs.dto.PageResponse;
import com.metaplatform.obs.trace.dto.Span;
import com.metaplatform.obs.trace.dto.TopologyGraph;
import com.metaplatform.obs.trace.dto.TraceDetail;
import com.metaplatform.obs.trace.service.TraceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/obs")
@RequiredArgsConstructor
public class TraceController {

    private final TraceService traceService;

    @GetMapping("/traces")
    public ApiResponse<PageResponse<Span>> searchTraces(
            @RequestParam(required = false) String service,
            @RequestParam(required = false) String operation,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime startTime,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime endTime,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        log.debug("Search traces: service={}, operation={}, page={}, size={}",
                service, operation, page, size);
        return ApiResponse.success(traceService.searchTraces(service, operation, startTime, endTime, page, size));
    }

    @GetMapping("/traces/{traceId}")
    public ApiResponse<TraceDetail> getTraceDetail(@PathVariable String traceId) {
        log.debug("Get trace detail: {}", traceId);
        return ApiResponse.success(traceService.getTraceDetail(traceId));
    }

    @GetMapping("/traces/{traceId}/spans")
    public ApiResponse<List<Span>> getTraceSpans(@PathVariable String traceId) {
        log.debug("Get trace spans: {}", traceId);
        return ApiResponse.success(traceService.getTraceSpans(traceId));
    }

    @GetMapping("/topology")
    public ApiResponse<TopologyGraph> getTopology() {
        log.debug("Get service topology");
        return ApiResponse.success(traceService.getTopology());
    }
}