package com.metaplatform.obs.controller;

import com.metaplatform.obs.common.ApiResponse;
import com.metaplatform.obs.dto.LogEntry;
import com.metaplatform.obs.dto.LogIngestRequest;
import com.metaplatform.obs.dto.LogQueryRequest;
import com.metaplatform.obs.dto.PageResponse;
import com.metaplatform.obs.service.LogIngestService;
import com.metaplatform.obs.service.LokiQueryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/v1/obs/logs")
@RequiredArgsConstructor
public class LogController {

    private final LokiQueryService lokiQueryService;
    private final LogIngestService logIngestService;

    @PostMapping("/query")
    public ApiResponse<PageResponse<LogEntry>> query(@Valid @RequestBody LogQueryRequest request) {
        log.debug("Log query received: service={}, level={}, keyword={}, traceId={}, page={}, size={}",
                request.getServiceName(), request.getLevel(), request.getKeyword(),
                request.getTraceId(), request.getPage(), request.getSize());
        return ApiResponse.success(lokiQueryService.query(request));
    }

    @PostMapping("/ingest")
    public ApiResponse<String> ingest(@Valid @RequestBody LogIngestRequest request) {
        String id = logIngestService.ingest(request);
        return ApiResponse.success(id);
    }
}