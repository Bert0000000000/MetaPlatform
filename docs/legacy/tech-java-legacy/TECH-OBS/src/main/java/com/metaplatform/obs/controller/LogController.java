package com.metaplatform.obs.controller;

import com.metaplatform.obs.common.ApiResponse;
import com.metaplatform.obs.dto.LogEntry;
import com.metaplatform.obs.dto.LogIngestRequest;
import com.metaplatform.obs.dto.LogQueryRequest;
import com.metaplatform.obs.dto.LogSearchRequest;
import com.metaplatform.obs.dto.LogSearchResponse;
import com.metaplatform.obs.dto.PageResponse;
import com.metaplatform.obs.dto.RegexSearchRequest;
import com.metaplatform.obs.service.LogIngestService;
import com.metaplatform.obs.service.LogSearchService;
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
    private final LogSearchService logSearchService;

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

    @PostMapping("/search")
    public ApiResponse<LogSearchResponse> search(@Valid @RequestBody LogSearchRequest request) {
        log.debug("Log search received: keyword={}, service={}, level={}, page={}, size={}",
                request.getKeyword(), request.getService(), request.getLevel(),
                request.getPage(), request.getSize());
        return ApiResponse.success(logSearchService.search(request));
    }

    @PostMapping("/search/regex")
    public ApiResponse<LogSearchResponse> searchRegex(@Valid @RequestBody RegexSearchRequest request) {
        log.debug("Log regex search received: pattern={}, service={}, level={}, page={}, size={}",
                request.getPattern(), request.getService(), request.getLevel(),
                request.getPage(), request.getSize());
        return ApiResponse.success(logSearchService.searchRegex(request));
    }
}